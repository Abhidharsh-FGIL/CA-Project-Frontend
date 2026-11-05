/**
 * "What to practise next" — the backend's personalised picks for one exam stage.
 *
 * The backend chooses by rules (mastery per unit / category, exam weight, time since practised) and ties every
 * pick to a real test; the AI only words the reason and the tip, from the numbers. See the backend's
 * recommendations handoff for the maths.
 */
import { userApi } from './api';
import { stageUnits, unitNameForId, type TnpscStage } from '@/config/tnpsc';
import type { TnpscTest } from './tnpscApi';
import { textLanguage, type ExamLanguage } from './exam-language';
import { bilingualTitle, isTamil, paperName, registerPair, type PaperLang } from './bilingual';

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
  unit: { id: string; name: string; label?: string | null; name_en?: string | null; name_ta?: string | null } | null;
  category: { id: string | null; name: string; name_en?: string | null; name_ta?: string | null } | null;
  /** The weakest sub-category inside the category, when there is one: what to focus on within the test. */
  subcategory: { id: string | null; name: string; mastery?: number | null; name_en?: string | null; name_ta?: string | null } | null;
  mastery: RecommendationMastery | null;
  target: RecommendationTarget;
  reason: string;
  tip: string | null;
  reason_source: 'ai' | 'template';
}

export interface WeakMapCategory {
  id: string | null;
  name: string;
  name_en?: string | null;
  name_ta?: string | null;
  mastery: number | null;
  attempted: number;
}

export interface WeakMapUnit {
  unit_id: string;
  unit_name: string;
  name_en?: string | null;
  name_ta?: string | null;
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
  /** The language paper the server made the picks for ("General English" / "General Tamil"), when it says. */
  language_paper?: string | null;
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
  get: async (exam: string, stage: string) => {
    const res = await userApi.get<Recommendations>(
      `/api/v1/user/recommendations?exam=${encodeURIComponent(exam)}&stage=${encodeURIComponent(stage)}`,
    );
    registerRecommendationNames(res);
    return res;
  },
  /** Answers with the refreshed picks (`recommendations`), the dismissed one replaced by the next. */
  feedback: (exam: string, stage: string, recId: string, action: RecommendationFeedback) =>
    userApi.post<{ ok: boolean; recommendations?: Recommendations }>(
      `/api/v1/user/recommendations/${encodeURIComponent(recId)}/feedback?exam=${encodeURIComponent(exam)}&stage=${encodeURIComponent(stage)}`,
      { action },
    ),
};

/** Every unit, category and sub-category name the server paired with its other language. */
function registerRecommendationNames(res: Recommendations | null | undefined): void {
  for (const r of res?.items ?? []) {
    if (r.unit) registerPair(r.unit.name, r.unit.name_en, r.unit.name_ta);
    if (r.category) registerPair(r.category.name, r.category.name_en, r.category.name_ta);
    if (r.subcategory) registerPair(r.subcategory.name, r.subcategory.name_en, r.subcategory.name_ta);
  }
  for (const u of res?.weak_map ?? []) {
    registerPair(u.unit_name, u.name_en, u.name_ta);
    for (const c of u.categories ?? []) registerPair(c.name, c.name_en, c.name_ta);
  }
}

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
 * Shown in both languages, English first: "Grammar / இலக்கணம்". Display only — never a key.
 */
export function displayUnitName(id: string | null | undefined, fallback: string): string {
  const name = unitNameForId(id) ?? fallback;
  const other = fallback && isTamil(fallback) !== isTamil(name) ? fallback : null;
  return paperName(name, unitPaperLang(id), other) || name;
}

/** The language paper a unit id belongs to: 'g4-ta-…' is General Tamil (Tamil only), 'g4-en-…' General English (English only). */
function unitPaperLang(id: string | null | undefined): PaperLang {
  if (/^g\d+-ta-/.test(id ?? '')) return 'ta';
  if (/^g\d+-en-/.test(id ?? '')) return 'en';
  return null;
}

/**
 * Where a pick sits, under its heading. A Key Topic names its unit ("Unit I · Aptitude"); a whole unit is already
 * named by its heading, so it only gives the unit's number; a mock gives its own title.
 */
export function recommendationPlace(r: Recommendation): string {
  if (!r.unit) return bilingualTitle(r.target.title ?? '');
  const label = r.unit.label ? `Unit ${r.unit.label}` : '';
  if (recommendationKind(r) === 'unit') return label;
  return `${label ? `${label} · ` : ''}${displayUnitName(r.unit.id, r.unit.name)}`;
}

/** The heading of a pick: the category its test covers, else the unit. The sub-category is shown as its focus. */
export function recommendationTitle(r: Recommendation): string {
  if (r.type === 'full_mock') return 'Full mock test';
  return r.category?.name ? paperName(r.category.name, unitPaperLang(r.unit?.id)) : r.unit ? displayUnitName(r.unit.id, r.unit.name) : 'Practice';
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

/**
 * The language paper a unit belongs to — General Tamil or General English — or null for a unit everyone sits.
 * The unit's id says it ("g4-ta-grammar", "g4-en-vocabulary"); failing that, its name ("General English").
 */
export function unitLanguage(id: string | null | undefined, name?: string | null): ExamLanguage | null {
  const m = /(?:^|-)(ta|en)(?:-|$)/.exec(id ?? '');
  if (m) return m[1] === 'ta' ? 'tamil' : 'english';
  return textLanguage(name);
}

/** The language paper a pick is for, or null when it is for everyone (General Studies, Aptitude, a full mock). */
export function recommendationLanguage(r: Recommendation): ExamLanguage | null {
  return (r.unit ? unitLanguage(r.unit.id, r.unit.name) : null) ?? textLanguage(r.target.title);
}

/**
 * The language paper the aspirant has been practising, from the picks' own record: the units they have a score in and
 * the readiness sections they have answered. Null when they have practised neither, or both.
 */
export function practisedLanguage(d: Pick<Recommendations, 'weak_map' | 'readiness'>): ExamLanguage | null {
  const seen = new Set<ExamLanguage>();
  for (const u of d.weak_map ?? []) {
    const l = u.mastery != null ? unitLanguage(u.unit_id, u.unit_name) : null;
    if (l) seen.add(l);
  }
  for (const s of d.readiness?.sections ?? []) {
    const l = (s.questions ?? 0) > 0 || (s.score ?? 0) > 0 ? textLanguage(s.name) : null;
    if (l) seen.add(l);
  }
  return seen.size === 1 ? [...seen][0] : null;
}

/**
 * The picks as someone sitting `language` should see them: General Tamil and General English are sat one instead of
 * the other, so nothing from the other paper — no pick, no unit on the skill map, no readiness row. Null shows all.
 */
export function recommendationsForLanguage(d: Recommendations, language: ExamLanguage | null): Recommendations {
  if (!language) return d;
  const other = (l: ExamLanguage | null) => l !== null && l !== language;
  return {
    ...d,
    items: d.items.filter(r => !other(recommendationLanguage(r))),
    weak_map: d.weak_map.filter(u => !other(unitLanguage(u.unit_id, u.unit_name))),
    improved: d.improved.filter(i => !other(unitLanguage(i.unit_id))),
    readiness: d.readiness && { ...d.readiness, sections: d.readiness.sections.filter(s => !other(textLanguage(s.name))) },
  };
}

/** Test ids the aspirant is being pointed to — for the "Recommended for you" badge elsewhere. */
export function recommendedTestIds(data: Recommendations | null | undefined): Set<string> {
  return new Set((data?.items ?? []).filter(r => !r.target.is_locked).map(r => r.target.test_id));
}

/** A pick the portal made itself, from the catalog; the server knows nothing of it, so it takes no feedback. */
export const LOCAL_PICK_PREFIX = 'local-';
export const isLocalPick = (r: Pick<Recommendation, 'rec_id'>) => r.rec_id.startsWith(LOCAL_PICK_PREFIX);

/**
 * "Start something new" picks from the exam's own catalog, to fill the places the server's picks leave empty.
 *
 * The server picks from what the aspirant has practised, so an aspirant who chose General Tamil but has only tried
 * English papers, or has never opened General Studies or Aptitude, is left with few picks or none. Each pick here is a
 * unit they have not practised, in their language paper or for everyone, with a real unit paper to start — in the
 * stage's order. At most `max`.
 */
export function starterPicks(args: {
  stage: TnpscStage | undefined;
  tests: TnpscTest[];
  language: ExamLanguage | null;
  data: Pick<Recommendations, 'items' | 'weak_map'>;
  max: number;
}): Recommendation[] {
  const { stage, tests, language, data, max } = args;
  if (!stage || max <= 0) return [];
  const taken = new Set(data.items.map(r => r.unit?.id).filter(Boolean));
  const practised = new Set(data.weak_map.filter(u => u.mastery != null).map(u => u.unit_id));
  const out: Recommendation[] = [];
  for (const { unit } of stageUnits(stage)) {
    if (out.length >= max) break;
    if (taken.has(unit.id) || practised.has(unit.id)) continue;
    const own = unitLanguage(unit.id, unit.name);
    if (language && own && own !== language) continue;
    const paper = tests.find(t => t.unit_id === unit.id && !t.topic_id && !t.is_locked);
    if (!paper) continue;
    out.push({
      rec_id: `${LOCAL_PICK_PREFIX}${unit.id}`,
      type: 'start_new',
      priority: 100 + out.length,
      unit: { id: unit.id, name: unit.name, label: unit.label ?? null, name_en: unit.name, name_ta: unit.name_ta ?? null },
      category: null,
      subcategory: null,
      mastery: null,
      target: {
        kind: 'unit_practice',
        test_id: paper.test_id,
        level: null,
        question_count: paper.question_count ?? null,
        est_minutes: paper.time_limit_minutes ?? null,
        is_locked: false,
        lock_reason: null,
        title: paper.title,
        source: paper.source,
      },
      reason: 'You have not practised this unit yet. A short set is a good way to begin.',
      tip: null,
      reason_source: 'template',
    });
  }
  return out;
}
