/**
 * RRB NTPC is sat at two levels — Graduate posts and Under-Graduate posts — and a paper is made for one of them.
 * The aspirant says which they are when they open the exam, can change it whenever they like, and is then shown the
 * papers for that level (and the ones that name no level, which are for everyone).
 *
 * The paper is also in one language — Tamil, English or Hindi — which the aspirant chooses in the same place. A paper says
 * its level and language the way a Group 4 paper says its language: the server's own `ntpc_level` / `language` when it
 * sends one, else the head of the paper's title ("RRB NTPC CBT-1 (Graduate · Tamil) — Mathematics: Percentage ·
 * Mixed"). A paper that says neither is shown to everyone.
 */
import { useCallback, useSyncExternalStore } from 'react';

export type NtpcLevel = 'graduate' | 'undergraduate';

export const NTPC_LEVELS: NtpcLevel[] = ['graduate', 'undergraduate'];

export const NTPC_LEVEL_LABEL: Record<NtpcLevel, string> = {
  graduate: 'Graduate',
  undergraduate: 'Under-Graduate',
};

/** The levels of the exam the portal prepares for: both RRB NTPC tests. */
export const isNtpcGroup = (groupId?: string | null) => !!groupId && groupId.startsWith('rrb-ntpc-');

/**
 * CBT-1 is offered as two exams, one per level: `rrb-ntpc-cbt-1` is the Under-Graduate one (the exam everyone had,
 * so saved choices and links keep working) and `rrb-ntpc-cbt-1-grad` the Graduate one. The exam says the level, so
 * the aspirant is not asked it there. CBT-2 is still one exam, sat at the level they chose.
 */
export const NTPC_EXAM_LEVEL: Readonly<Record<string, NtpcLevel>> = {
  'rrb-ntpc-cbt-1': 'undergraduate',
  'rrb-ntpc-cbt-1-grad': 'graduate',
};

/** The level an RRB NTPC exam is for, or null when the aspirant chooses it (CBT-2, and every other exam). */
export function ntpcFixedLevel(groupId?: string | null): NtpcLevel | null {
  return (groupId && NTPC_EXAM_LEVEL[groupId]) || null;
}

/** The CBT-1 exam for a level: Graduate's own, else the Under-Graduate one. */
export function ntpcCbt1ExamFor(level: NtpcLevel | null | undefined): string {
  return level === 'graduate' ? 'rrb-ntpc-cbt-1-grad' : 'rrb-ntpc-cbt-1';
}

/** A level as the server or an admin writes it: "graduate", "UG", "Under Graduate", "under-graduate". */
export function ntpcLevelOf(text?: string | null): NtpcLevel | null {
  const t = (text ?? '').toLowerCase();
  if (!t) return null;
  // Under-Graduate first: it contains the word "graduate".
  if (/\bunder[\s-]?graduate\b|\bug\b/.test(t)) return 'undergraduate';
  if (/\bgraduate\b|\bgrad\b/.test(t)) return 'graduate';
  return null;
}

export interface NtpcLevelSource {
  title?: string | null;
  ntpc_level?: string | null;
}

/** The level a paper is for, or null when it is for everyone. */
export function paperNtpcLevel(p: NtpcLevelSource): NtpcLevel | null {
  return ntpcLevelOf(p.ntpc_level) ?? ntpcLevelOf(p.title);
}

/** Whether a paper is for this aspirant: it names no level, or names theirs — or they have not chosen. */
export function paperIsForLevel(level: NtpcLevel | null, p: NtpcLevelSource): boolean {
  if (!level) return true;
  const own = paperNtpcLevel(p);
  return own === null || own === level;
}

export function papersForLevel<T extends NtpcLevelSource>(level: NtpcLevel | null, papers: T[]): T[] {
  return level ? papers.filter(p => paperIsForLevel(level, p)) : papers;
}


/**
 * The languages an NTPC paper can be in. RRB NTPC is set in many languages; these are the ones the portal offers.
 * (Group 4's language paper is only ever Tamil or English — `ExamLanguage` — and is a different choice.)
 */
export type NtpcLanguage = 'tamil' | 'english' | 'hindi';

export const NTPC_LANGUAGES: NtpcLanguage[] = ['tamil', 'english', 'hindi'];

export const NTPC_LANGUAGE_LABEL: Record<NtpcLanguage, string> = { tamil: 'Tamil', english: 'English', hindi: 'Hindi' };

/** The language written in its own script, for the aspirant's choice. */
export const NTPC_LANGUAGE_NATIVE: Record<NtpcLanguage, string> = { tamil: 'தமிழ்', english: 'English', hindi: 'हिन्दी' };

/** The words and codes that name each language in a title or a server field. */
const NTPC_LANGUAGE_WORDS: Record<NtpcLanguage, RegExp> = {
  tamil: /\btamil\b/i,
  english: /\benglish\b/i,
  hindi: /\bhindi\b/i,
};
const NTPC_LANGUAGE_CODES: Record<string, NtpcLanguage> = { tamil: 'tamil', ta: 'tamil', english: 'english', en: 'english', hindi: 'hindi', hi: 'hindi' };

export const isNtpcLanguage = (v: unknown): v is NtpcLanguage => typeof v === 'string' && (NTPC_LANGUAGES as string[]).includes(v);

/**
 * The language a paper's head names — the part of its title before the dash ("RRB NTPC CBT-1 (Graduate · Tamil)"),
 * never the unit after it. Null when it names none, or more than one.
 */
export function ntpcLanguageOfTitle(title?: string | null): NtpcLanguage | null {
  const head = (title ?? '').split(' — ')[0];
  const named = NTPC_LANGUAGES.filter(l => NTPC_LANGUAGE_WORDS[l].test(head));
  return named.length === 1 ? named[0] : null;
}

function languageOfCode(code?: string | null): NtpcLanguage | null {
  return NTPC_LANGUAGE_CODES[(code ?? '').trim().toLowerCase()] ?? null;
}

/** A language code or name ("hi", "Hindi") as an NTPC language, or null. */
export const languageOfNtpcCode = languageOfCode;

export interface NtpcPaperSource extends NtpcLevelSource {
  /** The language the server says the paper is in ("tamil" | "english"). */
  language?: string | null;
  ntpc_language?: string | null;
}

/** The language a paper is in, or null when it is for everyone. */
export function paperNtpcLanguage(p: NtpcPaperSource): NtpcLanguage | null {
  return languageOfCode(p.ntpc_language) ?? languageOfCode(p.language) ?? ntpcLanguageOfTitle(p.title);
}

/** What the aspirant chose for RRB NTPC. */
export interface NtpcPrefs {
  level: NtpcLevel | null;
  language: NtpcLanguage | null;
}

/** Whether a paper is for this aspirant: each of its level and language is unnamed, or theirs — or they have not chosen. */
export function paperIsForNtpc(prefs: NtpcPrefs | null | undefined, p: NtpcPaperSource): boolean {
  if (!prefs) return true;
  const lang = paperNtpcLanguage(p);
  return paperIsForLevel(prefs.level, p) && (!prefs.language || lang === null || lang === prefs.language);
}

export function papersForNtpc<T extends NtpcPaperSource>(prefs: NtpcPrefs | null | undefined, papers: T[]): T[] {
  return prefs && (prefs.level || prefs.language) ? papers.filter(p => paperIsForNtpc(prefs, p)) : papers;
}

// ─── The aspirant's choice ─────────────────────────────────────────────────────
// Kept in this browser, per signed-in person, and shared by every screen that shows it.

const KEY = 'mge.ntpc-prefs';
const listeners = new Set<() => void>();
const memory = new Map<string, string>();
const NONE: NtpcPrefs = { level: null, language: null };
/** The signed-in aspirant whose choice a plain function (a title) may read; set by the last `useNtpcPrefs`. */
let lastUserId: string | null | undefined;

const storageKey = (userId?: string | null) => `${KEY}.${userId ?? 'guest'}`;

function readRaw(userId?: string | null): string | null {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return memory.get(storageKey(userId)) ?? null;
  }
}

function writeRaw(userId: string | null | undefined, value: string) {
  memory.set(storageKey(userId), value);
  try {
    localStorage.setItem(storageKey(userId), value);
  } catch {
    /* storage blocked: the choice lasts until the page is closed */
  }
  listeners.forEach(l => l());
}

/** Parsed once per stored value, so a screen that reads it on every render gets the same object back. */
const parsed = new Map<string, NtpcPrefs>();
function current(userId?: string | null): NtpcPrefs {
  const raw = readRaw(userId);
  if (!raw) return NONE;
  const hit = parsed.get(raw);
  if (hit) return hit;
  let out = NONE;
  try {
    const o = JSON.parse(raw);
    out = {
      level: o?.level === 'graduate' || o?.level === 'undergraduate' ? o.level : null,
      language: isNtpcLanguage(o?.language) ? o.language : null,
    };
  } catch {
    /* an unreadable value is no choice */
  }
  parsed.set(raw, out);
  return out;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', cb);
  };
}

/**
 * The level and language the signed-in aspirant chose for RRB NTPC (null until they do), and how to change them.
 * `ready` is true once both are chosen.
 *
 * Given the exam (`groupId`), an exam that is for one level (`ntpcFixedLevel`: CBT-1 UG or Graduate) answers with that
 * level, is ready once a language is chosen, and saving there changes the language only — the level the aspirant
 * chose for CBT-2 is kept. `fixedLevel` says which it is, so the chooser can leave the level out.
 */
export function useNtpcPrefs(
  userId?: string | null,
  groupId?: string | null,
): NtpcPrefs & { ready: boolean; fixedLevel: NtpcLevel | null; save: (next: NtpcPrefs) => void } {
  lastUserId = userId;
  const prefs = useSyncExternalStore(
    subscribe,
    () => current(userId),
    () => NONE,
  );
  const fixedLevel = ntpcFixedLevel(groupId);
  const save = useCallback(
    (next: NtpcPrefs) =>
      writeRaw(userId, JSON.stringify(fixedLevel ? { level: current(userId).level, language: next.language } : next)),
    [userId, fixedLevel],
  );
  const level = fixedLevel ?? prefs.level;
  return { level, language: prefs.language, ready: !!level && !!prefs.language, fixedLevel, save };
}

/**
 * The language a bank question is written in: read from its letters (Tamil, Devanagari or Latin script), which is what a
 * reader sees, and the language it is stored under when the letters cannot say. Null when neither can — such a question is
 * kept rather than guessed at.
 */
export function questionNtpcLanguage(q: { language?: unknown; text?: unknown; question_text?: unknown; body?: unknown } | null | undefined): NtpcLanguage | null {
  const stored = languageOfCode(typeof q?.language === 'string' ? q.language : null);
  const text = [q?.text, q?.question_text, q?.body].find(t => typeof t === 'string' && t.trim()) as string | undefined;
  if (!text) return stored;
  let tamil = 0;
  let hindi = 0;
  let latin = 0;
  for (const ch of text) {
    if (ch >= '\u0B80' && ch <= '\u0BFF') tamil += 1;
    else if (ch >= '\u0900' && ch <= '\u097F') hindi += 1;
    else if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) latin += 1;
  }
  const total = tamil + hindi + latin;
  if (total < 8) return stored;
  // A question in one script carries a few words of another ("'Accountant' என்பதன்…"), so a clear majority is trusted.
  if (tamil / total >= 0.4) return 'tamil';
  if (hindi / total >= 0.4) return 'hindi';
  if (latin / total >= 0.9) return 'english';
  return stored;
}

const TRANSLATION_CODE: Record<NtpcLanguage, string> = { tamil: 'ta', english: 'en', hindi: 'hi' };

/**
 * A question list as an NTPC paper in its own language should show it: the server's language code, else the head of the title, which names it
 * ("RRB NTPC CBT-1 (Under-Graduate · Tamil)"); the second language beside the English is that one only, so a Tamil
 * paper never offers Hindi. A question that carries no copy in that language keeps its English alone rather than
 * showing another language. Papers that name no NTPC language, or are English, are returned as they are.
 */
export function questionsForPaperLanguage<T extends { translations?: unknown }>(questions: T[], title?: string | null, paperCode?: string | null): T[] {
  // Only RRB NTPC papers: another exam's title may name a language that is a subject ("General Tamil"), not the paper's.
  if (!/^RRB NTPC/i.test((title ?? '').trim())) return questions;
  const language = languageOfCode(paperCode) ?? ntpcLanguageOfTitle(title);
  if (!language || language === 'english') return questions;
  const code = TRANSLATION_CODE[language];
  return questions.map(q => {
    const all = q?.translations;
    if (!all || typeof all !== 'object') return q;
    const kept = Object.fromEntries(Object.entries(all as Record<string, unknown>).filter(([k]) => k === code));
    return Object.keys(kept).length === Object.keys(all as object).length ? q : { ...q, translations: kept };
  });
}

/** The language the signed-in aspirant chose for RRB NTPC, for code that is not a component. Null until they choose. */
export function activeNtpcLanguage(): NtpcLanguage | null {
  if (lastUserId !== undefined) return current(lastUserId).language;
  // No screen has read it yet (a page opened directly): the choice stored in this browser, when there is exactly one.
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(`${KEY}.`));
    return keys.length === 1 ? current(keys[0].slice(KEY.length + 1)).language : null;
  } catch {
    return null;
  }
}

/**
 * What an RRB NTPC paper opens showing: the language it was taken in — its own for English, the translation for Tamil or
 * Hindi. "both" for any other paper, as before. The reader can still switch.
 */
export function defaultQuestionLanguage(title?: string | null, paperCode?: string | null): 'both' | 'primary' | 'translation' {
  if (!/^RRB NTPC/i.test((title ?? '').trim())) return 'both';
  const language = languageOfCode(paperCode) ?? ntpcLanguageOfTitle(title);
  return !language ? 'both' : language === 'english' ? 'primary' : 'translation';
}
