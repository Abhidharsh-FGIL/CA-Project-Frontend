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
 * A single language, not a stacked pair.
 *
 * The test screen offers 'both' because a candidate sitting a bilingual paper
 * reads one language and checks the other. A report's Question Review is read,
 * not sat: stacking two copies of a five-option question doubles the card for
 * no gain, so that screen offers a two-state toggle over these roles only.
 */
export type SingleLangMode = Exclude<LangMode, 'both'>;

/** One question's displayable text, in whichever language was chosen. */
export interface QuestionCopy {
  body: string;
  options: string[] | null;
  explanation: string | null;
}

/**
 * Which mode renders `preferred`, given the paper's translation language.
 *
 * Expressed in language codes rather than roles because "show English by
 * default" has to hold either way round: these papers are written in Tamil with
 * an English `translations.en`, but the reverse arrangement exists, and a
 * default hardcoded to 'translation' would show Tamil on one and English on the
 * other. Falls back to 'primary' for a paper with no translation at all, and
 * for one whose two languages don't include the preferred one — showing the
 * language the paper was written in beats showing nothing.
 */
export function defaultLangMode(translation: string | null, preferred = 'en'): SingleLangMode {
  if (!translation) return 'primary';
  return translation === preferred ? 'translation' : 'primary';
}

/**
 * The two choices a toggle offers, `preferred` first so it reads as the default
 * it is.
 */
export function langToggleOptions(
  translation: string,
  preferred = 'en',
): Array<{ mode: SingleLangMode; code: string; label: string }> {
  const entries: Array<{ mode: SingleLangMode; code: string }> = [
    { mode: 'translation', code: translation },
    { mode: 'primary', code: primaryLangOf(translation) },
  ];
  const ordered = [
    ...entries.filter(e => e.code === preferred),
    ...entries.filter(e => e.code !== preferred),
  ];
  return ordered.map(e => ({ ...e, label: TRANSLATION_LABELS[e.code] ?? e.code.toUpperCase() }));
}

/**
 * Translated options, index by index, falling back to the original for any the
 * translation is missing.
 *
 * Never returns a different length from `base`. The A–E letters on a review
 * screen are positions, and the stored answers point at those positions — a
 * translation that dropped or added an option would slide every letter after it
 * and mark the wrong option as the candidate's. The backend states these arrays
 * are index-aligned; this makes a payload that isn't harmless rather than
 * silently wrong.
 */
function mergedOptions(base: string[] | null, translated: unknown): string[] | null {
  if (!base) return base;
  if (!Array.isArray(translated) || translated.length === 0) return base;
  return base.map((o, i) => {
    const t = translated[i];
    return typeof t === 'string' && t.trim() ? t : o;
  });
}

/**
 * One question's text in the chosen language, falling back field by field.
 *
 * Partial translations are normal — a paper often carries a translated stem and
 * options but leaves `explanation` in the original. Falling back per field
 * means choosing English never blanks a card; it shows English wherever English
 * exists and the original everywhere else.
 */
export function questionCopyForMode(
  translations: Record<string, QuestionTranslationBlock> | null | undefined,
  base: QuestionCopy,
  translation: string | null,
  mode: SingleLangMode,
): QuestionCopy {
  if (mode === 'primary' || !translation) return base;
  const tr = translations?.[translation];
  if (!tr) return base;
  const text = typeof tr.text === 'string' && tr.text.trim() ? tr.text : base.body;
  const explanation =
    typeof tr.explanation === 'string' && tr.explanation.trim() ? tr.explanation : base.explanation;
  return { body: text, options: mergedOptions(base.options, tr.options), explanation };
}
