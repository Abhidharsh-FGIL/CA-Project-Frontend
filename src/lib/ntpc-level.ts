/**
 * RRB NTPC is sat at two levels — Graduate posts and Under-Graduate posts — and a paper is made for one of them.
 * The aspirant says which they are when they open the exam, can change it whenever they like, and is then shown the
 * papers for that level (and the ones that name no level, which are for everyone).
 *
 * The paper is also in one language — Tamil, English, Hindi or Telugu — which the aspirant chooses in the same place. A paper says
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
export type NtpcLanguage = 'tamil' | 'english' | 'hindi' | 'telugu';

export const NTPC_LANGUAGES: NtpcLanguage[] = ['tamil', 'english', 'hindi', 'telugu'];

export const NTPC_LANGUAGE_LABEL: Record<NtpcLanguage, string> = { tamil: 'Tamil', english: 'English', hindi: 'Hindi', telugu: 'Telugu' };

/** The language written in its own script, for the aspirant's choice. */
export const NTPC_LANGUAGE_NATIVE: Record<NtpcLanguage, string> = { tamil: 'தமிழ்', english: 'English', hindi: 'हिन्दी', telugu: 'తెలుగు' };

/** The words and codes that name each language in a title or a server field. */
const NTPC_LANGUAGE_WORDS: Record<NtpcLanguage, RegExp> = {
  tamil: /\btamil\b/i,
  english: /\benglish\b/i,
  hindi: /\bhindi\b/i,
  telugu: /\btelugu\b/i,
};
const NTPC_LANGUAGE_CODES: Record<string, NtpcLanguage> = { tamil: 'tamil', ta: 'tamil', english: 'english', en: 'english', hindi: 'hindi', hi: 'hindi', telugu: 'telugu', te: 'telugu' };

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
 */
export function useNtpcPrefs(userId?: string | null): NtpcPrefs & { ready: boolean; save: (next: NtpcPrefs) => void } {
  const prefs = useSyncExternalStore(
    subscribe,
    () => current(userId),
    () => NONE,
  );
  const save = useCallback((next: NtpcPrefs) => writeRaw(userId, JSON.stringify(next)), [userId]);
  return { ...prefs, ready: !!prefs.level && !!prefs.language, save };
}
