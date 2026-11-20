import { api } from '@/lib/api';

/** One text the mobile app has: its key, the built-in wording, and the group it is listed under. */
export interface AppContentEntry {
  key: string;
  text: string;
  group: string;
}

/** GET /api/v1/admin/app-content/catalogue → `{ entries: [{ key, text, group }] }` — every text the app has, with its built-in text. */
export async function getAppContentCatalogue(): Promise<AppContentEntry[]> {
  const res = (await api.get<unknown>('/api/v1/admin/app-content/catalogue')) as { entries?: unknown } | null;
  const list = Array.isArray(res?.entries) ? (res!.entries as unknown[]) : [];
  const out: AppContentEntry[] = [];
  for (const e of list) {
    const r = e as Record<string, unknown>;
    if (r && typeof r.key === 'string' && typeof r.text === 'string') out.push({ key: r.key, text: r.text, group: typeof r.group === 'string' && r.group.trim() ? r.group : 'Other' });
  }
  return out;
}

/** GET /api/v1/admin/app-content → `{ content: { "<key>": "<text>" } }` — only the texts already changed. */
export async function getAppContent(): Promise<Record<string, string>> {
  const res = (await api.get<unknown>('/api/v1/admin/app-content')) as { content?: unknown } | null;
  const map = res?.content && typeof res.content === 'object' ? (res.content as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) if (typeof v === 'string' && v.trim() !== '') out[k] = v;
  return out;
}

/** PUT /api/v1/admin/app-content `{ content }` — replaces what is stored: send the WHOLE map of changed texts. */
export function saveAppContent(content: Record<string, string>): Promise<unknown> {
  return api.put('/api/v1/admin/app-content', { content });
}

/** `{name}` placeholders in a text. */
export const placeholdersOf = (text: string): string[] => Array.from(new Set(Array.from(text.matchAll(/\{(\w+)\}/g), m => m[1])));

/** The placeholders the built-in text has and the edited text has lost. */
export function missingPlaceholders(builtIn: string, edited: string): string[] {
  const kept = new Set(placeholdersOf(edited));
  return placeholdersOf(builtIn).filter(p => !kept.has(p));
}

export const CATALOGUE_LIMITS = { entries: 5000, text: 4000, group: 80 } as const;

/** PUT /api/v1/admin/app-content/catalogue `{ entries }` — replaces the whole list of the app's texts (admin token). */
export function saveAppContentCatalogue(entries: AppContentEntry[]): Promise<unknown> {
  return api.put('/api/v1/admin/app-content/catalogue', { entries });
}

/**
 * Read a catalogue file the app team made: `{ "entries": [{ key, text, group }] }` (or just the list). Checks what the
 * server checks — unique keys, up to 5,000 entries, text up to 4,000 characters, group up to 80 — and says what is wrong.
 */
export function parseCatalogueFile(raw: string): { entries: AppContentEntry[]; problems: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch {
    return { entries: [], problems: ['This is not a JSON file.'] };
  }
  const list = Array.isArray(json) ? json : Array.isArray((json as { entries?: unknown } | null)?.entries) ? (json as { entries: unknown[] }).entries : null;
  if (!list) return { entries: [], problems: ['Expected { "entries": [ { "key", "text", "group" } ] }.'] };

  const problems: string[] = [];
  const seen = new Set<string>();
  const entries: AppContentEntry[] = [];
  list.forEach((e, i) => {
    const r = (e ?? {}) as Record<string, unknown>;
    const at = `Entry ${i + 1}`;
    if (typeof r.key !== 'string' || r.key.trim() === '') return void problems.push(`${at}: "key" is missing.`);
    if (typeof r.text !== 'string') return void problems.push(`${at} (${r.key}): "text" is missing.`);
    if (r.text.length > CATALOGUE_LIMITS.text) return void problems.push(`${at} (${r.key}): text is over ${CATALOGUE_LIMITS.text} characters.`);
    const group = typeof r.group === 'string' && r.group.trim() ? r.group.trim() : '';
    if (!group) return void problems.push(`${at} (${r.key}): "group" is missing.`);
    if (group.length > CATALOGUE_LIMITS.group) return void problems.push(`${at} (${r.key}): group is over ${CATALOGUE_LIMITS.group} characters.`);
    if (seen.has(r.key)) return void problems.push(`${at}: the key "${r.key}" appears more than once.`);
    seen.add(r.key);
    entries.push({ key: r.key, text: r.text, group });
  });
  if (list.length === 0) problems.push('The list is empty.');
  if (list.length > CATALOGUE_LIMITS.entries) problems.push(`There are ${list.length} entries; the limit is ${CATALOGUE_LIMITS.entries}.`);
  return { entries, problems };
}

/** A small example the app team can start from. */
export const SAMPLE_CATALOGUE = {
  entries: [
    { key: 'auth.login.title', text: 'Welcome Back', group: 'Sign in, register & onboarding' },
    { key: 'home.greeting', text: 'Hello, {name}!', group: 'Home' },
  ],
};
