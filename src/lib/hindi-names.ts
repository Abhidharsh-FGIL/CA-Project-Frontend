/**
 * Hindi names the server sent (`name_hi`, `topic_name_hi`, `unit_name_hi`, `category_hi`…), keyed by the English name.
 *
 * Kept apart from the Tamil registry in `bilingual.ts` because the NTPC syllabus config reads it and `bilingual.ts`
 * reads that config. Same rule as Tamil: the server's wording wins, and where it sent none the caller shows English.
 */
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');

const DEVANAGARI = /[\u0900-\u097F]/;
export const isHindi = (s: string) => DEVANAGARI.test(s);

const byEnglish = new Map<string, string>();

/** Remember the Hindi for an English name. Ignored unless the first really is Latin and the second Devanagari. */
export function registerHindi(en: unknown, hi: unknown): void {
  if (typeof en !== 'string' || typeof hi !== 'string') return;
  const e = en.trim();
  const h = hi.trim();
  if (!e || !h || isHindi(e) || !isHindi(h)) return;
  byEnglish.set(norm(e), h);
}

/** The server's Hindi for an English name, or null when it has sent none. */
export function hindiName(en: string | null | undefined): string | null {
  const e = (en ?? '').trim();
  return e ? byEnglish.get(norm(e)) ?? null : null;
}
