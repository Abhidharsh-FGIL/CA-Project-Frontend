/**
 * The cards on the Exams page, as the admin edits them.
 *
 * An exam *card* is its presentation — name, body, description, logo, colour, languages, and where it sits. It is not the
 * exam: stages, subjects and papers come from the catalog (`GET /user/tnpsc/catalog`), and whether the exam is open is the
 * admin's Active switch (`/admin/exams`). A card whose id is in the catalog is that exam's card; a card whose id is not
 * is an *announced* exam — greyed, "Coming soon", nothing behind it.
 *
 * `GET` / `PUT /api/v1/admin/exam-cards` carry the list and `PUT` replaces it; `GET /api/v1/user/exam-cards` is the same
 * list for aspirants. Until the server has them the page uses the built-in cards (`legacyEntries`), so it never goes blank.
 */
import type { TnpscGroup } from '@/config/tnpsc';
import { EXAM_CARD_ORDER, UPCOMING_EXAMS, splitExams, type UpcomingExam } from '@/lib/exam-listing';
import { NTPC_LANGUAGES, isLanguageExam, isNtpcLanguage, type NtpcLanguage } from '@/lib/ntpc-level';
import { defaultToneKey, isToneKey, type ExamToneKey } from '@/lib/exam-tones';

export interface ExamCard {
  /** The catalog's exam id for an exam; a slug of the admin's choosing for an announced one. */
  id: string;
  name: string;
  /** The body that conducts it — the card's eyebrow. */
  authority: string;
  tagline: string;
  description: string;
  /** An uploaded emblem. '' means the built-in one. */
  logo_url: string;
  /** '' means the exam's own colour. */
  tone: ExamToneKey | '';
  /** null means the built-in list for this exam. */
  languages: NtpcLanguage[] | null;
  /** The papers an *announced* exam examines. An exam in the catalog takes its subjects from the syllabus instead. */
  subjects: string[];
}

export const EXAM_CARD_LIMITS = {
  id: 64,
  name: 80,
  authority: 100,
  tagline: 120,
  description: 400,
  subject: 80,
  subjects: 20,
  logo_url: 500,
  cards: 60,
} as const;

/** What a card can be uploaded as, and how big. */
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;
export const LOGO_MAX_BYTES = 1024 * 1024;

const SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const len = (s: string) => [...s].length;
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** A name as an id: "IBPS Clerk / CSA" → "ibps-clerk-csa". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, EXAM_CARD_LIMITS.id);
}

// ─── What the Exams page lists ─────────────────────────────────────────────────

/** One thing on the Exams page: an exam that is in the catalog, or an announced one that is not. */
export type ExamEntry =
  | { kind: 'exam'; group: TnpscGroup; comingSoon: boolean; card?: ExamCard }
  | { kind: 'announced'; exam: UpcomingExam; card?: ExamCard };

export const entryId = (e: ExamEntry): string => (e.kind === 'exam' ? e.group.id : e.exam.id);

/** Shown after everything else, whatever the catalog's order. */
const LAST_EXAM_IDS: ReadonlySet<string> = new Set(['group-1']);

/**
 * The built-in order, used until the admin has saved one: the lead cards, the open exams, the coming-soon ones, the
 * announced ones, and the exams the product has least to do with last.
 */
export function legacyEntries(groups: TnpscGroup[], openIds: ReadonlySet<string>): ExamEntry[] {
  const featured = EXAM_CARD_ORDER.map(id => groups.find(g => g.id === id)).filter((g): g is TnpscGroup => !!g);
  const split = splitExams(groups.filter(g => !EXAM_CARD_ORDER.includes(g.id)), openIds);
  const exam = (group: TnpscGroup, comingSoon: boolean): ExamEntry => ({ kind: 'exam', group, comingSoon });
  return [
    ...featured.map(g => exam(g, !openIds.has(g.id))),
    ...split.open.map(g => exam(g, false)),
    ...split.soon.filter(g => !LAST_EXAM_IDS.has(g.id)).map(g => exam(g, true)),
    ...UPCOMING_EXAMS.map((e): ExamEntry => ({ kind: 'announced', exam: e })),
    ...split.soon.filter(g => LAST_EXAM_IDS.has(g.id)).map(g => exam(g, true)),
  ];
}

/** The languages an exam's papers come in when the admin has not said: TNPSC's two, RRB NTPC's and SSC CHSL's three, none for the rest. */
export function builtInLanguages(groupId: string): NtpcLanguage[] {
  if (isLanguageExam(groupId)) return [...NTPC_LANGUAGES];
  if (/^group-\d+$/.test(groupId)) return ['tamil', 'english'];
  return [];
}

/** An exam with the admin's wording laid over the catalog's. A blank field leaves the catalog's alone. */
export function applyCard(group: TnpscGroup, card?: ExamCard): TnpscGroup {
  if (!card) return group;
  return {
    ...group,
    name: card.name || group.name,
    authority: card.authority || group.authority,
    tagline: card.tagline || group.tagline,
    description: card.description || group.description,
  };
}

/** An announced card as the page draws it. */
export const announcedFromCard = (c: ExamCard): UpcomingExam => ({
  id: c.id,
  name: c.name,
  authority: c.authority,
  tagline: c.tagline,
  description: c.description,
  subjects: c.subjects,
});

/**
 * What the Exams page lists, in order: the open exams first, then the rest (see `openFirst`).
 *
 * Within each, with no saved cards it is the built-in listing. With some, their order is the page's order: a card in the catalog is that
 * exam's card (open or coming soon by its Active switch), a card that is not is an announced exam. An exam the catalog has
 * that no card names yet still shows, after them — a new exam on the server must not vanish for want of a card.
 */
export function examEntries(groups: TnpscGroup[], openIds: ReadonlySet<string>, cards?: ExamCard[]): ExamEntry[] {
  return openFirst(orderedEntries(groups, openIds, cards));
}

/**
 * Exams open to students first, then everything else (coming soon and announced), each group keeping its own order. An
 * aspirant looks for what they can sit today, so a newly opened exam must not wait behind a coming-soon card because of where
 * the saved order, or the catalog, happens to put it.
 */
export function openFirst(entries: ExamEntry[]): ExamEntry[] {
  const isOpen = (e: ExamEntry) => e.kind === 'exam' && !e.comingSoon;
  return [...entries.filter(isOpen), ...entries.filter(e => !isOpen(e))];
}

function orderedEntries(groups: TnpscGroup[], openIds: ReadonlySet<string>, cards?: ExamCard[]): ExamEntry[] {
  if (!cards || cards.length === 0) return legacyEntries(groups, openIds);

  const byId = new Map<string, TnpscGroup>(groups.map(g => [g.id, g]));
  const named = new Set(cards.map(c => c.id));
  const listed: ExamEntry[] = cards.map(card => {
    const group = byId.get(card.id);
    return group
      ? { kind: 'exam', group: applyCard(group, card), comingSoon: !openIds.has(group.id), card }
      : { kind: 'announced', exam: announcedFromCard(card), card };
  });
  const rest = legacyEntries(groups, openIds).filter(e => e.kind === 'exam' && !named.has(e.group.id));
  return [...listed, ...rest];
}

// ─── What the admin edits ──────────────────────────────────────────────────────

const seedFromGroup = (g: TnpscGroup, index: number): ExamCard => ({
  id: g.id,
  name: g.name,
  authority: g.authority,
  tagline: g.tagline,
  description: g.description,
  logo_url: '',
  tone: defaultToneKey(g.id, index),
  languages: builtInLanguages(g.id),
  subjects: [],
});

const seedFromAnnounced = (e: UpcomingExam, index: number): ExamCard => ({
  id: e.id,
  name: e.name,
  authority: e.authority,
  tagline: e.tagline,
  description: e.description,
  logo_url: '',
  tone: defaultToneKey(e.id, index),
  languages: [],
  subjects: [...e.subjects],
});

/** The card an exam has before anyone edits it. */
export function builtInCard(entry: ExamEntry, index = 0): ExamCard {
  return entry.kind === 'exam' ? seedFromGroup(entry.group, index) : seedFromAnnounced(entry.exam, index);
}

/** The saved card with any blank field filled from what the page already shows, so the editor never opens empty. */
function filled(card: ExamCard, seed: ExamCard): ExamCard {
  return {
    ...card,
    name: card.name || seed.name,
    authority: card.authority || seed.authority,
    tagline: card.tagline || seed.tagline,
    description: card.description || seed.description,
    tone: card.tone || seed.tone,
    languages: card.languages ?? seed.languages,
    subjects: card.subjects.length > 0 ? card.subjects : seed.subjects,
  };
}

/**
 * The list the admin works on: the saved cards in their saved order, then every exam the catalog has that has none yet.
 * With nothing saved it is the built-in list — exactly what the page shows today — so the first save changes nothing
 * until something is edited. A built-in announced exam the admin removed stays removed.
 */
export function adminCardList(saved: ExamCard[] | undefined, groups: TnpscGroup[], openIds: ReadonlySet<string>): ExamCard[] {
  const seeds = legacyEntries(groups, openIds).map((e, i) => ({ kind: e.kind, card: builtInCard(e, i) }));
  if (!saved || saved.length === 0) return seeds.map(s => s.card);

  const seedById = new Map(seeds.map(s => [s.card.id, s.card]));
  const named = new Set(saved.map(c => c.id));
  return [
    ...saved.map(c => (seedById.has(c.id) ? filled(c, seedById.get(c.id)!) : c)),
    ...seeds.filter(s => s.kind === 'exam' && !named.has(s.card.id)).map(s => s.card),
  ];
}

// ─── The wire ──────────────────────────────────────────────────────────────────

const orNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());

/** The server's list as cards, in the order saved. Missing or odd fields become empty ones. */
export function parseExamCards(raw: unknown): ExamCard[] {
  const list: unknown = Array.isArray(raw) ? raw : (raw as { items?: unknown; cards?: unknown } | null)?.items ?? (raw as { cards?: unknown } | null)?.cards;
  if (!Array.isArray(list)) return [];
  return list
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((r, i) => ({ r, i, o: typeof r.order === 'number' ? r.order : Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.o - b.o || a.i - b.i)
    .map(({ r }): ExamCard => ({
      id: text(r.id),
      name: text(r.name),
      authority: text(r.authority),
      tagline: text(r.tagline),
      description: text(r.description),
      logo_url: text(r.logo_url),
      tone: isToneKey(r.tone) ? r.tone : '',
      languages: Array.isArray(r.languages) ? NTPC_LANGUAGES.filter(l => (r.languages as unknown[]).includes(l)) : null,
      subjects: Array.isArray(r.subjects) ? r.subjects.map(text).filter(Boolean) : [],
    }))
    .filter(c => c.id !== '');
}

/** The cards as the server's body: every card, each with its position as `order`, and no other keys. */
export function toExamCardsBody(cards: ExamCard[]) {
  return {
    items: cards.map((c, i) => ({
      id: c.id.trim(),
      name: c.name.trim(),
      authority: orNull(c.authority),
      tagline: orNull(c.tagline),
      description: orNull(c.description),
      logo_url: orNull(c.logo_url),
      tone: c.tone || null,
      languages: c.languages ? c.languages.filter(isNtpcLanguage) : null,
      subjects: [...new Set(c.subjects.map(s => s.trim()).filter(Boolean))],
      order: i + 1,
    })),
  };
}

// ─── Checks ────────────────────────────────────────────────────────────────────

/**
 * What is wrong with one card, by field. `takenIds` are the other cards' ids; `inCatalog` says the card is an exam the
 * catalog has (then only its wording is checked, and its subjects are not asked for).
 */
export function validateExamCard(card: ExamCard, takenIds: ReadonlySet<string>, inCatalog: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  const over = (key: string, value: string, max: number) => {
    if (len(value.trim()) > max) errors[key] = `At most ${max} characters (${len(value.trim())} now).`;
  };

  const id = card.id.trim();
  if (!id) errors.id = 'Give the exam an id.';
  else if (!SLUG.test(id)) errors.id = 'Lowercase letters, digits, - or _ only, starting with a letter or digit.';
  else if (len(id) > EXAM_CARD_LIMITS.id) errors.id = `At most ${EXAM_CARD_LIMITS.id} characters.`;
  else if (takenIds.has(id)) errors.id = 'Another card already has this id.';

  if (!card.name.trim()) errors.name = 'Give the exam a name.';
  else over('name', card.name, EXAM_CARD_LIMITS.name);
  if (!inCatalog && !card.authority.trim()) errors.authority = 'Say who conducts it.';
  over('authority', card.authority, EXAM_CARD_LIMITS.authority);
  over('tagline', card.tagline, EXAM_CARD_LIMITS.tagline);
  over('description', card.description, EXAM_CARD_LIMITS.description);

  if (card.logo_url.trim() && len(card.logo_url.trim()) > EXAM_CARD_LIMITS.logo_url) errors.logo_url = 'That address is too long.';

  if (!inCatalog) {
    const subjects = card.subjects.map(s => s.trim()).filter(Boolean);
    if (subjects.length > EXAM_CARD_LIMITS.subjects) errors.subjects = `At most ${EXAM_CARD_LIMITS.subjects} subjects.`;
    else if (subjects.some(s => len(s) > EXAM_CARD_LIMITS.subject)) errors.subjects = `Keep each subject under ${EXAM_CARD_LIMITS.subject} characters.`;
  }
  return errors;
}

/** Whether a file can be uploaded as a card's logo — its message when it cannot. */
export function logoFileProblem(file: { type: string; size: number }): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) return 'Use a PNG, JPG, WebP or SVG image.';
  if (file.size > LOGO_MAX_BYTES) return `Keep the image under ${LOGO_MAX_BYTES / 1024 / 1024} MB.`;
  return null;
}

/**
 * The list with one card of a chosen few moved up or down among those few only — the open exams, say — swapping it with
 * its neighbour in that set. Every other card keeps its place. `slots` are the indexes in `list` of the set, in order.
 */
export function moveWithin<T>(list: T[], slots: number[], k: number, dir: -1 | 1): T[] {
  const j = k + dir;
  if (k < 0 || k >= slots.length || j < 0 || j >= slots.length) return list;
  const next = [...list];
  [next[slots[k]], next[slots[j]]] = [next[slots[j]], next[slots[k]]];
  return next;
}
