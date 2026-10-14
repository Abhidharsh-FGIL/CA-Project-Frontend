/**
 * Drawing an assessment's questions by syllabus unit.
 *
 * The commission publishes Group 4 as numbered units with a question count each,
 * and that is the level an admin thinks at — "20 from Unit V, 15 from Unit IV" —
 * but the question bank is tagged by subject and topic. This is the bridge, so the
 * Source & content step can offer the units and still end up with bank questions.
 *
 * A question belongs to a unit by one of three routes, strongest first:
 *
 *  1. It names its unit (`unit_id`). Exact, and what the server should send once it
 *     stores one — see BACKEND_WORK.md item 7.
 *  2. Otherwise by subject, then by topic where the subject alone is ambiguous.
 *     Most units own their subject outright (Unit IV is Indian Polity and nothing
 *     else), so the subject decides. General Tamil's seven units and the two
 *     aptitude units share one subject each, so for those the question's Topic has
 *     to name the unit or one of its printed topics. That is the part that depends
 *     on every sheet spelling the topic the same way, which is why route 1 exists.
 *
 *  3. Failing both, the name of the collection it sits in — `Unit_4_Tamil_50Q_Hard` —
 *     when that names a unit and the paper it belongs to. For units whose questions are
 *     tagged by the discipline they are about (Tamil technical terms: `புள்ளியியல்`,
 *     `மருத்துவம்`), nothing in the question says which unit it is, and the collection's
 *     name is the only place the author said so. See `collection-unit.ts`.
 *
 * A question matching no unit is not forced into one. It is counted as unmapped, so
 * the admin can see how much of the bank this picker cannot reach rather than
 * discovering it as a short pool.
 */
import {
  resolveSubjectId,
  stageUnits,
  subjectForUnit,
  unitTopics,
  type TnpscStage,
  type TnpscSyllabusUnit,
} from '@/config/tnpsc';
import { G4_SUBJECT_ALIASES, G4_UNIT_HINTS, splitTag } from '@/config/g4-tag-aliases';
import { parseCollectionTitle, unitFromCollectionTitle } from '@/lib/collection-unit';

/** Compare topic names the way a reader would: case, punctuation and "&" are noise. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/and/g, ' ')
    // Unicode-aware so Tamil survives; combining marks are kept because Tamil vowel
    // signs are marks, not letters, and dropping them folds different words together.
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The name with and without its parenthetical gloss: "இலக்கணம் (Grammar)" → both forms. */
function nameKeys(name: string | undefined): string[] {
  if (!name) return [];
  const full = norm(name);
  const bare = norm(name.replace(/\([^)]*\)/g, ' '));
  return full === bare ? [full] : [full, bare];
}

/** The catalog subjects a unit draws on — one for most, two for Units III and V. */
export function unitSubjectIds(stage: TnpscStage | undefined, unit: TnpscSyllabusUnit): string[] {
  if (unit.subject_ids?.length) return unit.subject_ids;
  const id = subjectForUnit(stage, unit);
  return id ? [id] : [];
}

/** The question's own unit, when the server stores one. */
function explicitUnit(q: any): string | null {
  const id = q?.unit_id ?? q?.tnpsc_unit_id;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

/**
 * A stage's units, worked out once.
 *
 * Matching runs over the whole question bank — tens of thousands of rows — so
 * anything that does not depend on the question must not be redone per question.
 * The first version rebuilt each unit's name set and re-resolved every subject on
 * every call and took over a minute on 20,000 questions, freezing the page. Here the
 * per-unit facts are computed once per stage, and the per-question lookups (subject →
 * catalog id, tag → normalised keys) are cached by the string, of which a bank has a
 * few hundred however many questions it holds.
 */
interface CompiledUnit {
  unit: TnpscSyllabusUnit;
  subjectIds: Set<string>;
  /** Another unit of the stage draws on one of this unit's subjects. */
  shared: boolean;
  /** Every spelling under which a tag may *equal* this unit's name or one of its topics. */
  keys: Set<string>;
  /** Words that, appearing whole inside a tag, name this unit (spaced form). */
  hints: string[];
}

/** What a subject string resolved to, and any label left over once it was taken apart. */
interface ResolvedSubject {
  id: string;
  tail: string[];
}

interface Compiled {
  units: CompiledUnit[];
  byId: Map<string, CompiledUnit>;
  bySubject: Map<string, CompiledUnit[]>;
  /** Tag → the one unit it names, for tags that are unambiguous without a subject. */
  labelIndex: Map<string, string>;
  /**
   * Names that both a Tamil unit and an English unit carry ("Technical Terms", "Grammar").
   * The word does not say which paper the question is from; the language it is written in does.
   */
  languagePairs: Map<string, { ta: string; en: string }>;
  /** "Part A – Unit VI" → the unit it names. Part A is General Studies, Part B Aptitude. */
  partUnits: Map<string, string>;
  subjectAliases: Array<{ id: string; keys: string[] }>;
  subjectCache: Map<string, ResolvedSubject | null>;
  labelCache: Map<string, LabelSet>;
}

const COMPILED = new WeakMap<TnpscStage, Compiled>();

const TAMIL_SCRIPT = /[஀-௿]/;
const squash = (k: string) => k.replace(/ /g, '');

const tagParts = splitTag;

function compile(stage: TnpscStage): Compiled {
  const hit = COMPILED.get(stage);
  if (hit) return hit;

  const units: CompiledUnit[] = stageUnits(stage).map(({ unit }) => {
    const keys = new Set<string>();
    const addKeys = (v: string | undefined) =>
      nameKeys(v).forEach(k => {
        if (!k) return;
        keys.add(k);
        keys.add(squash(k));
      });
    addKeys(unit.name);
    addKeys(unit.name_ta);
    for (const t of unitTopics(stage, unit)) {
      addKeys(t.name);
      addKeys(t.id);
    }
    const hints = (G4_UNIT_HINTS[unit.id] ?? []).flatMap(h => nameKeys(h)).filter(Boolean);
    // A hint that is a whole name ("இலக்கியம்") must also *equal*, not only be contained.
    hints.forEach(h => {
      keys.add(h);
      keys.add(squash(h));
    });
    return { unit, subjectIds: new Set(unitSubjectIds(stage, unit)), shared: false, keys, hints };
  });

  const bySubject = new Map<string, CompiledUnit[]>();
  for (const cu of units) {
    for (const id of cu.subjectIds) bySubject.set(id, [...(bySubject.get(id) ?? []), cu]);
  }
  for (const cu of units) {
    cu.shared = [...cu.subjectIds].some(id => (bySubject.get(id)?.length ?? 0) > 1);
  }

  // Tags that name exactly one unit with no subject beside them. Tamil script is
  // Tamil's alone, and a General Studies unit's full printed name is its alone; an
  // English word like "Vocabulary" belongs to the Tamil paper and the English one alike,
  // so it never goes in here.
  const claimed = new Map<string, Set<string>>();
  const claim = (k: string, id: string) => {
    if (!k) return;
    const set = claimed.get(k) ?? new Set<string>();
    set.add(id);
    claimed.set(k, set);
  };
  for (const cu of units) {
    const languageUnit = [...cu.subjectIds].every(id => id === 'general-tamil' || id === 'general-english');
    const generalStudies = !languageUnit && !cu.shared;
    for (const k of cu.keys) {
      if (TAMIL_SCRIPT.test(k)) claim(k, cu.unit.id);
    }
    if (generalStudies) {
      nameKeys(cu.unit.name).forEach(k => {
        claim(k, cu.unit.id);
        claim(squash(k), cu.unit.id);
      });
    }
  }
  const labelIndex = new Map<string, string>();
  for (const [k, ids] of claimed) if (ids.size === 1) labelIndex.set(k, [...ids][0]);

  const pairing = new Map<string, { ta?: string; en?: string }>();
  for (const cu of units) {
    const lang = cu.subjectIds.has('general-tamil') ? 'ta' : cu.subjectIds.has('general-english') ? 'en' : null;
    if (!lang) continue;
    for (const k of keysOfPiece(cu.unit.name)) {
      const entry = pairing.get(k) ?? {};
      entry[lang] = cu.unit.id;
      pairing.set(k, entry);
    }
  }
  const languagePairs = new Map<string, { ta: string; en: string }>();
  for (const [k, v] of pairing) if (v.ta && v.en) languagePairs.set(k, { ta: v.ta, en: v.en });

  const partUnits = new Map<string, string>();
  for (const { unit, sectionName } of stageUnits(stage)) {
    const part = /general studies/i.test(sectionName) ? 'a' : /aptitude/i.test(sectionName) ? 'b' : null;
    if (part && unit.label) partUnits.set(`${part} ${unit.label.toLowerCase()}`, unit.id);
  }

  const out: Compiled = {
    units,
    byId: new Map(units.map(cu => [cu.unit.id, cu])),
    bySubject,
    labelIndex,
    languagePairs,
    partUnits,
    subjectAliases: Object.entries(G4_SUBJECT_ALIASES)
      .filter(([id]) => bySubject.has(id))
      .map(([id, names]) => ({ id, keys: names.flatMap(n => nameKeys(n)).filter(Boolean) })),
    subjectCache: new Map(),
    labelCache: new Map(),
  };
  COMPILED.set(stage, out);
  return out;
}

/** The catalog's answer, then the spellings real sheets use. */
function subjectIdOf(stage: TnpscStage, c: Compiled, text: string): string | undefined {
  const known = resolveSubjectId(stage, text);
  if (known) return known;
  const keys = nameKeys(text).flatMap(k => [k, squash(k)]);
  return c.subjectAliases.find(a => a.keys.some(k => keys.includes(k) || keys.includes(squash(k))))?.id;
}

function resolveSubject(stage: TnpscStage, c: Compiled, subject: unknown): ResolvedSubject | null {
  if (typeof subject !== 'string' || !subject.trim()) return null;
  const cached = c.subjectCache.get(subject);
  if (cached !== undefined) return cached;

  let result: ResolvedSubject | null = null;
  const whole = subjectIdOf(stage, c, subject);
  if (whole) {
    result = { id: whole, tail: [] };
  } else {
    // "பொதுத்தமிழ் - பகுதி அ - இலக்கணம்": the subject is the first piece, the rest is the unit.
    const parts = tagParts(subject);
    const head = parts.length > 1 ? subjectIdOf(stage, c, parts[0]) : undefined;
    if (head) {
      result = { id: head, tail: parts.slice(1) };
    } else {
      // "English Grammar": a language word followed by what it is about.
      const n = norm(subject);
      for (const a of c.subjectAliases) {
        const lead = a.keys.find(k => n.startsWith(k + ' '));
        if (lead) {
          result = { id: a.id, tail: [n.slice(lead.length + 1)] };
          break;
        }
      }
    }
  }
  c.subjectCache.set(subject, result);
  return result;
}

/** A tag's spellings: the whole of it, its leading piece, and the pieces after. */
interface LabelSet {
  whole: string[];
  lead: string[];
  rest: string[];
}

const NO_LABELS: LabelSet = { whole: [], lead: [], rest: [] };

/** Normalised spellings of one piece — spaced and squashed — so Tamil spacing does not matter. */
function keysOfPiece(piece: string): string[] {
  const out = new Set<string>();
  for (const k of nameKeys(piece)) {
    if (!k) continue;
    out.add(k);
    out.add(squash(k));
  }
  return [...out];
}

function labelSetOf(c: Compiled, raw: unknown): LabelSet {
  if (typeof raw !== 'string' || !raw.trim()) return NO_LABELS;
  const cached = c.labelCache.get(raw);
  if (cached) return cached;
  const parts = tagParts(raw);
  const set: LabelSet = {
    whole: keysOfPiece(raw),
    lead: parts.length > 0 ? keysOfPiece(parts[0]) : [],
    rest: parts.slice(1).flatMap(keysOfPiece),
  };
  c.labelCache.set(raw, set);
  return set;
}

const allKeys = (s: LabelSet) => [...s.whole, ...s.lead, ...s.rest];

/** Whether any of the labels equals this unit's name or topic, or contains one of its hints. */
function unitNamed(cu: CompiledUnit, labels: string[]): boolean {
  if (labels.some(k => cu.keys.has(k))) return true;
  if (cu.hints.length === 0) return false;
  return labels.some(k => {
    const hay = ` ${k} `;
    return cu.hints.some(h => hay.includes(` ${h} `));
  });
}

/** The collection a bank question came from, when the caller has joined it on. */
function collectionTitleOf(q: any): string | null {
  const t = q?.paper_title ?? q?.collection_title;
  return typeof t === 'string' && t.trim() ? t : null;
}

type Via = 'unit_id' | 'tags' | 'collection';

/** Where a question lands, and which route put it there. */
function placeQuestion(stage: TnpscStage, c: Compiled, q: any): { units: CompiledUnit[]; via: Via | null } {
  const explicit = explicitUnit(q);
  if (explicit) {
    const cu = c.byId.get(explicit);
    return cu ? { units: [cu], via: 'unit_id' } : { units: [], via: null };
  }

  const tagged = unitsFromTags(stage, c, q);
  if (tagged.length > 0) return { units: tagged, via: 'tags' };

  const id = unitFromCollectionTitle(stage, collectionTitleOf(q));
  const cu = id ? c.byId.get(id) : undefined;
  return cu ? { units: [cu], via: 'collection' } : { units: [], via: null };
}

/**
 * The language a question is written in, from its letters: 'ta', 'en', or null when it is
 * too short or too mixed to say.
 *
 * Tamil questions carry English words ("'Accountant' என்பதன் தமிழ்ச்சொல் எது?") and English
 * ones carry none, so a clear majority either way is trusted and the middle is not.
 */
function scriptOf(text: unknown): 'ta' | 'en' | null {
  if (typeof text !== 'string') return null;
  let tamil = 0;
  let latin = 0;
  for (const ch of text) {
    if (ch >= '஀' && ch <= '௿') tamil += 1;
    else if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) latin += 1;
  }
  if (tamil + latin < 8) return null;
  const share = tamil / (tamil + latin);
  if (share >= 0.4) return 'ta';
  if (share <= 0.1) return 'en';
  return null;
}

/**
 * A tag that names a unit of the Tamil paper and of the English paper alike, settled by the
 * question's own language.
 *
 * "Technical Terms" as a Subject is both Tamil unit IV and English unit IV. Refusing to guess
 * left two whole sheets — 100 English questions — out of the unit they were written for. The
 * text settles it: an English question is English-paper, a Tamil one is Tamil-paper. Nothing
 * is claimed when the text is missing or mixed, or when the tags name more than one pair.
 */
function unitFromSharedName(c: Compiled, labels: string[], q: any): CompiledUnit | null {
  const pairs = new Map<string, { ta: string; en: string }>();
  for (const k of labels) {
    const p = c.languagePairs.get(k);
    if (p) pairs.set(`${p.ta}|${p.en}`, p);
  }
  if (pairs.size !== 1) return null;
  const pair = [...pairs.values()][0];
  const lang = scriptOf(q?.text ?? q?.question_text ?? q?.body);
  if (!lang) return null;
  return c.byId.get(lang === 'ta' ? pair.ta : pair.en) ?? null;
}

/** Every unit a question belongs to. Usually one, often none, and rarely two. */
function unitsForQuestion(stage: TnpscStage, c: Compiled, q: any): CompiledUnit[] {
  return placeQuestion(stage, c, q).units;
}

/** The units a question's own tags place it in. */
function unitsFromTags(stage: TnpscStage, c: Compiled, q: any): CompiledUnit[] {
  /*
   * "Part A – Unit VI", with nothing else, is a complete address: Part A is General Studies and
   * its unit VI is Tamil Nadu history. Part C (Tamil / English) is not, since both papers have
   * a unit VI, so only A and B are read.
   */
  if (typeof q?.subject === 'string') {
    const m = /^(?:part|பகுதி) ([ab]) (?:unit|அலகு) ([ivx]+)$/.exec(norm(q.subject));
    const id = m ? c.partUnits.get(`${m[1]} ${m[2]}`) : undefined;
    const cu = id ? c.byId.get(id) : undefined;
    if (cu) return [cu];
  }

  const subject = resolveSubject(stage, c, q?.subject);
  const detail = [q?.chapter, q?.topic, q?.subtopic].map(v => labelSetOf(c, v));

  if (subject) {
    const candidates = c.bySubject.get(subject.id) ?? [];
    // A unit that owns its subject needs nothing more.
    const owned = candidates.filter(cu => !cu.shared);
    if (owned.length > 0) return owned;

    /*
     * Units sharing a subject are told apart by what the tags say, strongest first. What
     * the author wrote in the Subject ("தமிழ் – சொல்லகராதி") is the unit they meant;
     * the leading piece of a Topic ("Writing Skills – Prepositions") is next; the detail
     * after it is last. The first tier that names a unit decides, so a detail that the
     * catalog lists under another unit ("எதிர்ச்சொல்" under Grammar) cannot override it.
     */
    const tiers: string[][] = [
      [...allKeys(labelSetOf(c, q?.subject)), ...subject.tail.flatMap(t => allKeys(labelSetOf(c, t)))],
      detail.flatMap(d => [...d.whole, ...d.lead]),
      detail.flatMap(d => d.rest),
    ];
    for (const tier of tiers) {
      const named = candidates.filter(cu => unitNamed(cu, tier));
      if (named.length > 0) return named;
    }
    return [];
  }

  // The subject is unknown, so a tag has to carry the unit on its own — and only if it
  // names exactly one.
  const labels = [...allKeys(labelSetOf(c, q?.subject)), ...detail.flatMap(allKeys)];
  const named = new Set<string>();
  for (const k of labels) {
    const id = c.labelIndex.get(k);
    if (id) named.add(id);
  }
  if (named.size === 0) {
    const byLanguage = unitFromSharedName(c, labels, q);
    return byLanguage ? [byLanguage] : [];
  }
  if (named.size !== 1) return [];
  const cu = c.byId.get([...named][0]);
  return cu ? [cu] : [];
}

/** The ids of every unit a bank question belongs to — usually one, often none. */
export function unitIdsOf(stage: TnpscStage | undefined, q: any): string[] {
  if (!stage || !q) return [];
  return unitsForQuestion(stage, compile(stage), q).map(cu => cu.unit.id);
}

/**
 * The catalog subject a question belongs to — by its Subject if that names one, otherwise
 * by the unit its Topic names.
 *
 * Some sheets put the *passage's* subject in the Subject column ("தகவல் தொழில்நுட்பம்",
 * "மருத்துவம்") and the unit in the Topic. The subject alone resolves to nothing, and the
 * question then drops out of its subject on the test screen, goes to the end of the paper
 * and gets its own row in the report. The Topic knows better.
 *
 * Undefined when neither says: a question in two units, or in none, is not guessed at.
 */
export function subjectIdForQuestion(
  stage: TnpscStage | undefined,
  q:
    | {
        subject?: string | null;
        chapter?: string | null;
        topic?: string | null;
        subtopic?: string | null;
        /** The question itself — a shared name like "Technical Terms" is settled by its language. */
        text?: string | null;
        body?: string | null;
      }
    | null
    | undefined,
): string | undefined {
  if (!stage || !q) return undefined;
  const direct = resolveSubjectId(stage, q.subject);
  if (direct) return direct;
  const units = unitIdsOf(stage, {
    subject: q.subject,
    chapter: q.chapter ?? q.topic,
    subtopic: q.subtopic,
    text: q.text ?? q.body,
  });
  if (units.length !== 1) return undefined;
  return subjectForUnit(stage, stageUnits(stage).find(x => x.unit.id === units[0])?.unit);
}

/** Whether a bank question belongs to the unit. */
export function questionInUnit(stage: TnpscStage | undefined, q: any, unit: TnpscSyllabusUnit): boolean {
  if (!stage || !q) return false;
  const c = compile(stage);
  if (!c.byId.has(unit.id)) return false;
  return unitsForQuestion(stage, c, q).some(cu => cu.unit.id === unit.id);
}

/** Whether a question is in any of the chosen units. No units chosen means no restriction. */
export function inSelectedUnits(
  stage: TnpscStage | undefined,
  q: any,
  units: TnpscSyllabusUnit[],
): boolean {
  if (units.length === 0) return true;
  if (!stage || !q) return false;
  const c = compile(stage);
  const mine = unitsForQuestion(stage, c, q);
  return mine.length > 0 && units.some(u => mine.some(cu => cu.unit.id === u.id));
}

export interface UnitBankCounts {
  byUnit: Record<string, number>;
  /**
   * Questions placed only by the name of their collection, with the collections that
   * did it. Surfaced so the admin can see the rule at work and disagree with it.
   */
  viaCollection: { total: number; titles: Array<{ title: string; count: number }> };
  /**
   * Collections named like a unit's — `Unit_4_Maths` — that do not say which paper they
   * belong to, and whose questions are therefore in no unit.
   */
  unclearCollections: Array<{ title: string; count: number }>;
  /**
   * Questions in one of this exam's subjects that no unit claims.
   *
   * Current Events is the usual cause (the syllabus puts current affairs inside each
   * unit, so a question under that name is in none), then a shared-subject unit whose
   * Topic was spelt differently. Unreachable from this picker until it is fixed.
   */
  unmapped: number;
}

/** How many bank questions each unit can draw on, and how many belong to none. */
export function unitBankCounts(stage: TnpscStage | undefined, questions: any[]): UnitBankCounts {
  const byUnit: Record<string, number> = {};
  const none = { total: 0, titles: [] as Array<{ title: string; count: number }> };
  if (!stage) return { byUnit, unmapped: 0, viaCollection: none, unclearCollections: [] };
  const c = compile(stage);
  for (const cu of c.units) byUnit[cu.unit.id] = 0;
  let unmapped = 0;
  const viaTitles = new Map<string, number>();
  const unclear = new Map<string, number>();

  for (const q of questions) {
    const { units: hit, via } = placeQuestion(stage, c, q);
    for (const cu of hit) byUnit[cu.unit.id] += 1;
    if (via === 'collection') {
      const t = collectionTitleOf(q)!;
      viaTitles.set(t, (viaTitles.get(t) ?? 0) + 1);
    }
    if (hit.length === 0) {
      if (explicitUnit(q) || resolveSubject(stage, c, q?.subject)) unmapped += 1;
      const title = collectionTitleOf(q);
      if (title && parseCollectionTitle(stage, title).looksLikeUnit) unclear.set(title, (unclear.get(title) ?? 0) + 1);
    }
  }
  const ranked = (m: Map<string, number>) =>
    [...m.entries()].map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  const viaList = ranked(viaTitles);
  return {
    byUnit,
    unmapped,
    viaCollection: { total: viaList.reduce((n, x) => n + x.count, 0), titles: viaList },
    unclearCollections: ranked(unclear),
  };
}

/**
 * Weights that follow the published split.
 *
 * Choosing Units IV and V should default to 15:20, the way the real paper weighs
 * them, not to an even 50:50 that no exam has ever used. Percentages to two
 * decimals summing to exactly 100 (what `validateWeightage` accepts); falls back to
 * an even split if a published count would round below the 1% minimum.
 */
export function unitWeightsFromSyllabus(units: TnpscSyllabusUnit[]): Record<string, number> {
  if (units.length === 0) return {};
  if (units.length === 1) return { [units[0].id]: 100 };

  const total = units.reduce((s, u) => s + Math.max(0, u.questions), 0);
  if (total <= 0) return evenSplit(units);

  // Work in hundredths of a percent so the remainder can be handed out exactly.
  const raw = units.map(u => ({ id: u.id, exact: (Math.max(0, u.questions) / total) * 10000 }));
  const floors = raw.map(r => ({ ...r, cents: Math.floor(r.exact), rem: r.exact - Math.floor(r.exact) }));
  let spare = 10000 - floors.reduce((s, r) => s + r.cents, 0);
  [...floors].sort((a, b) => b.rem - a.rem).forEach(r => {
    if (spare > 0) {
      r.cents += 1;
      spare -= 1;
    }
  });

  const out: Record<string, number> = {};
  for (const r of floors) out[r.id] = r.cents / 100;
  return Object.values(out).some(v => v < 1) ? evenSplit(units) : out;
}

function evenSplit(units: TnpscSyllabusUnit[]): Record<string, number> {
  const base = Math.floor(10000 / units.length) / 100;
  const out: Record<string, number> = {};
  units.forEach((u, i) => {
    out[u.id] = i < units.length - 1 ? base : Math.round((100 - base * (units.length - 1)) * 100) / 100;
  });
  return out;
}

/**
 * Per-unit weights collapsed to per-subject ones, for a server that only knows subjects.
 *
 * Each unit's weight is spread across the subject names its pool actually carries, in
 * proportion to the questions behind each, then summed by name. It is lossy by
 * construction — Tamil's seven units are one subject, so their weights merge — and
 * that is exactly why the server needs `unit_weights` (BACKEND_WORK.md item 14).
 */
export function subjectWeightsFromUnits(
  unitWeights: Record<string, number>,
  poolByUnit: Record<string, Array<{ subject?: string | null }>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [unitId, weight] of Object.entries(unitWeights)) {
    const pool = poolByUnit[unitId] ?? [];
    const counts = new Map<string, number>();
    for (const q of pool) {
      const name = (q.subject ?? '').trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const n = [...counts.values()].reduce((s, c) => s + c, 0);
    if (n === 0) continue;
    for (const [name, c] of counts) out[name] = (out[name] ?? 0) + (weight * c) / n;
  }
  // Two decimals, and the last entry absorbs rounding so the total is exactly 100.
  const names = Object.keys(out);
  let assigned = 0;
  names.forEach((name, i) => {
    if (i < names.length - 1) {
      out[name] = Math.round(out[name] * 100) / 100;
      assigned += out[name];
    } else {
      out[name] = Math.round((100 - assigned) * 100) / 100;
    }
  });
  return out;
}

/**
 * The subject names a set of questions actually carries, most common first.
 *
 * Shown when a unit pool comes back empty although the bank is not: the usual cause
 * is a name the catalog does not know ("Tamil", "General Studies"), and the fastest
 * way to see that is to read the names the bank holds next to the ones expected.
 */
export function subjectSpread(questions: Array<{ subject?: string | null }>, limit = 8): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const q of questions) {
    const name = (q?.subject ?? '').trim() || '(no subject)';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}
