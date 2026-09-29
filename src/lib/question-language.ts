/**
 * Bilingual question rendering, shared by the test screen and the report.
 *
 * A TNPSC Group 4 paper prints every question twice — once in the language it was
 * written in and once under `translations`. The test screen has always let an
 * aspirant choose which to read; the report's Question Insights needs the same
 * control over the same data, and the two must agree about what "bilingual" even
 * means. These helpers were local to the test screen; they live here so there is
 * one answer rather than two that drift.
 *
 * The question shapes differ between the two endpoints — the test screen's
 * question calls its stem `text`, the report's calls it `body` — so everything
 * here takes the stem explicitly rather than guessing at a field name.
 */

export const TRANSLATION_LABELS: Record<string, string> = { ta: 'தமிழ்', en: 'English', hi: 'हिन्दी' };

/**
 * Which language(s) of a bilingual paper to display.
 *
 * 'primary' is the language the paper is written in and the one answers are stored
 * in; 'translation' is the copy under `translations`. Kept as roles rather than
 * language codes so rendering never has to guess which is which.
 */
export type LangMode = 'both' | 'primary' | 'translation';

/** One language's copy of a question. */
export interface QuestionTranslationBlock {
  text?: string;
  options?: string[];
  passage?: string | null;
  explanation?: string | null;
}

/**
 * The language a bilingual paper is written in, given the language of its
 * translation. Papers here are generated in English with a Tamil translation
 * alongside; the only inversion in practice is an English translation sitting on a
 * Tamil paper, so the pair is simply the other of the two.
 */
export function primaryLangOf(translation: string): string {
  return translation === 'en' ? 'ta' : 'en';
}

/**
 * Does this translation block actually carry anything?
 *
 * Papers routinely arrive with an empty `translations: { ta: {} }` — the key is
 * present but there is no Tamil in it. Treating that as a translation put a
 * toggle on single-language papers with nothing to toggle.
 */
export function hasTranslationContent(tr: any): boolean {
  if (!tr || typeof tr !== 'object') return false;
  if (typeof tr.text === 'string' && tr.text.trim()) return true;
  if (typeof tr.explanation === 'string' && tr.explanation.trim()) return true;
  return Array.isArray(tr.options) && tr.options.some((o: any) => typeof o === 'string' && o.trim());
}

/** The language code a question carries a translation for, if any. */
export function translationLang(q: any): string | null {
  const entry = Object.entries(q?.translations ?? {}).find(([, tr]) => hasTranslationContent(tr));
  return entry ? entry[0] : null;
}

/**
 * A question is bilingual only when it has text in *both* languages.
 *
 * A paper written solely in Tamil can arrive with its only copy under
 * `translations` — offering to hide it would blank the question entirely.
 *
 * `stem` is passed in because the two endpoints name it differently.
 */
export function isBilingualQuestion(q: any, stem: unknown): boolean {
  const primary = typeof stem === 'string' ? stem.trim() : '';
  return !!primary && !!translationLang(q);
}

/** The translation block for a question, unless the reader asked for the primary only. */
export function translationOf(q: any, show: boolean): QuestionTranslationBlock | null {
  if (!show) return null;
  const lang = translationLang(q);
  return lang ? q.translations[lang] : null;
}

/**
 * The language a paper can be switched into, or null when it carries only one.
 *
 * Null means no control is offered: a toggle that changes nothing on screen
 * teaches the reader to distrust the ones that do.
 */
export function paperTranslationLang(questions: any[], stemOf: (q: any) => unknown): string | null {
  const q = questions.find(x => isBilingualQuestion(x, stemOf(x)));
  return q ? translationLang(q) : null;
}

/** The two option labels a `LangMode` select offers for a given translation language. */
export function langModeOptions(translation: string): Array<{ value: LangMode; label: string }> {
  const primary = primaryLangOf(translation);
  return [
    { value: 'both', label: 'Both' },
    { value: 'primary', label: TRANSLATION_LABELS[primary] ?? primary },
    { value: 'translation', label: TRANSLATION_LABELS[translation] ?? translation },
  ];
}

/**
 * The two sides of a language toggle: one language or the other, no 'both'.
 *
 * A select offering three modes made the reader choose between two languages
 * *and* a stacked view before they could read the question. A paper is read in
 * one language at a time, so the control is one switch with two named sides.
 *
 * Ordered with the paper's own language first, since that is what the options
 * were stored and graded in.
 */
export function langToggleOptions(
  translation: string,
): Array<{ value: Exclude<LangMode, 'both'>; label: string }> {
  const primary = primaryLangOf(translation);
  return [
    { value: 'primary', label: TRANSLATION_LABELS[primary] ?? primary },
    { value: 'translation', label: TRANSLATION_LABELS[translation] ?? translation },
  ];
}

/**
 * One question resolved into a single language.
 *
 * The payload keeps the two languages apart — the stem, options and explanation
 * the paper was written in sit at the top level, and the other language sits
 * under `translations.<code>`. Reading in one language therefore means picking a
 * side field by field, not hiding half the card: a paper can carry a Tamil stem
 * with no Tamil explanation, and blanking the explanation because the reader
 * asked for Tamil loses the only copy there is.
 *
 * So each field falls back to the primary when the translation has nothing for
 * it, and `usedFallback` says whether that happened, for a caller that wants to
 * mark it.
 */
export function resolveLanguage<T>(
  q: any,
  mode: LangMode,
  primary: { text: T; options: unknown; explanation: string | null | undefined },
): { text: T; options: unknown; explanation: string | null | undefined; usedFallback: boolean } {
  if (mode !== 'translation') return { ...primary, usedFallback: false };

  const tr = translationOf(q, true);
  const trText = typeof tr?.text === 'string' && tr.text.trim() ? (tr.text as unknown as T) : null;
  const trOptions =
    Array.isArray(tr?.options) && tr.options.some(o => typeof o === 'string' && o.trim())
      ? tr.options
      : null;
  const trExplanation =
    typeof tr?.explanation === 'string' && tr.explanation.trim() ? tr.explanation : null;

  return {
    text: trText ?? primary.text,
    options: trOptions ?? primary.options,
    explanation: trExplanation ?? primary.explanation,
    usedFallback: trText == null || trOptions == null || trExplanation == null,
  };
}
