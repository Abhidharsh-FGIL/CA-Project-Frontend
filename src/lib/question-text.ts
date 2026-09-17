/**
 * Question-stem cleanup.
 *
 * The generator sometimes appends the answer choices to the question text as
 * well as returning them in `options`, so the paper shows them twice:
 *
 *   text:    "Who is the author of 'Thirukkural'? 1) Kambar 2) Bharathiyar 3) Thiruvalluvar 4) Avvaiyar"
 *   options: ["Kambar", "Bharathiyar", "Thiruvalluvar", "Avvaiyar", "Answer not known"]
 *
 * `stripInlineOptions` removes that trailing run — but only when it genuinely
 * duplicates the options, because plenty of legitimate TNPSC stems are numbered
 * lists in their own right ("Consider the following statements: 1) … 2) …").
 */

/**
 * An option that carries an image instead of (or alongside) text.
 */
export interface RichOption {
  text: string | null;
  image_url: string | null;
}

/**
 * Recover an image option that reached us as a *stringified* dict.
 *
 * Image-based questions come back with their options serialised by Python's
 * `str()` rather than as JSON, so instead of an object the client is handed the
 * literal text:
 *
 *   "{'text': None, 'image_url': '/static/questions/72613f97….png'}"
 *
 * which then gets printed verbatim in place of the picture. The URL is right
 * there, so parse it back rather than showing the repr to a candidate.
 *
 * Returns null for anything that is not one of these — ordinary option text is
 * left completely alone.
 */
export function parseOptionRepr(value: unknown): RichOption | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw.startsWith('{') || !raw.endsWith('}')) return null;
  // Cheap guard so arbitrary brace-wrapped prose never reaches the parser.
  if (!/['"](?:image_url|imageUrl|text)['"]\s*:/.test(raw)) return null;

  // Python literals → JSON. Only the three constants and quote style differ; the
  // structure is already JSON-shaped.
  const jsonish = raw
    .replace(/\bNone\b/g, 'null')
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/'/g, '"');

  try {
    const parsed = JSON.parse(jsonish);
    if (!parsed || typeof parsed !== 'object') return null;
    const text = parsed.text ?? null;
    const image = parsed.image_url ?? parsed.imageUrl ?? null;
    if (text == null && image == null) return null;
    return {
      text: text == null ? null : String(text),
      image_url: image == null ? null : String(image),
    };
  } catch {
    return null;
  }
}

/**
 * Normalise any option shape — object, plain string, or the stringified dict
 * above — into `{ text, image_url }`.
 */
export function normaliseOption(value: unknown): RichOption {
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return {
      text: o.text == null ? null : String(o.text),
      image_url: o.image_url == null ? (o.imageUrl == null ? null : String(o.imageUrl)) : String(o.image_url),
    };
  }
  const recovered = parseOptionRepr(value);
  if (recovered) return recovered;
  return { text: value == null ? null : String(value), image_url: null };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * "1)" · "1." · "(1)" · "[1]" · "a)" · "A." — the usual inline-choice markers.
 *
 * Anchored to a line start or whitespace, otherwise the last letter of a word can
 * pose as one: without the anchor, "sentence: (a) …" matches at the "e", and the
 * stem gets truncated to "…correct sentenc".
 *
 * A colon is deliberately NOT a marker terminator for the same reason —
 * "Assertion:" and "sentence:" would both qualify.
 */
const MARKER = String.raw`(?:^|[\s\n])(?:\(|\[)?\s*(?:\d{1,2}|[a-eA-E])\s*(?:\)|\.|\])\s*`;

/**
 * Options that are nothing but labels — "(a)", "B.", "3" — mean the real choices
 * live in the stem. Stripping there destroys the question rather than tidying it.
 */
function optionsAreLabelsOnly(opts: string[]): boolean {
  const labelish = /^[([]?\s*(?:\d{1,2}|[a-eA-E])\s*[)\].]?\s*$/;
  const substantive = opts.filter(o => !/^answer not known$/i.test(o) && !/^விடை தெரியவில்லை$/.test(o));
  return substantive.length > 0 && substantive.every(o => labelish.test(o));
}

/** Loose equality — ignores case, punctuation spacing and repeated whitespace. */
function normalise(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Strip a trailing inline list of answer choices from a question stem.
 * Returns the text unchanged when no duplicated run is found.
 */
export function stripInlineOptions(text: string | null | undefined, options: unknown): string {
  if (!text || typeof text !== 'string') return text ?? '';
  const opts = (Array.isArray(options) ? options : [])
    .map(o => (o && typeof o === 'object' ? (o as any).text : o))
    .filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
    .map(o => o.trim());

  if (opts.length < 2) return text;

  // "Spot the correct sentence: (a) … (b) …" with options ["(a)", "(b)"] — the
  // sentences only exist in the stem, so there is nothing to remove.
  if (optionsAreLabelsOnly(opts)) return text;

  // Locate a marker immediately followed by the first option.
  const start = new RegExp(MARKER + escapeRe(opts[0]), 'i').exec(text);
  if (!start || start.index <= 0) return text;

  // The marker pattern consumes the whitespace that anchors it; keep that
  // character with the head so the stem never loses its last letter.
  const anchorsOnWhitespace = /^[\s\n]/.test(start[0]);
  const cut = start.index + (anchorsOnWhitespace ? 1 : 0);

  const head = text.slice(0, cut);
  const tail = text.slice(cut);

  // Only a duplicate if the tail also carries the following options, in order.
  let cursor = 0;
  let matched = 0;
  for (const opt of opts) {
    const at = normalise(tail).indexOf(normalise(opt), cursor);
    if (at === -1) break;
    cursor = at + normalise(opt).length;
    matched += 1;
  }

  // Two matches could be coincidence in a statement-list stem; require most of
  // the choice set, tolerating a missing "Answer not known" style filler.
  const enough = matched >= Math.min(opts.length, 3) && matched >= opts.length - 1;
  if (!enough) return text;

  // Never strip the whole stem away.
  const cleaned = head.replace(/[\s\-–—:;,]+$/, '').trim();
  return cleaned.length > 0 ? cleaned : text;
}

/** Apply the same cleanup to a translation block, using its own options. */
export function stripInlineOptionsFromTranslation<
  T extends { text?: string; options?: string[] } | undefined | null,
>(translation: T): T {
  if (!translation || !translation.text) return translation;
  return { ...translation, text: stripInlineOptions(translation.text, translation.options) } as T;
}

/** Clean a whole question object (stem + every translation) in one call. */
export function cleanQuestionText<T extends Record<string, any>>(q: T): T {
  const text = stripInlineOptions(q.text, q.options);
  const translations = q.translations
    ? Object.fromEntries(
        Object.entries(q.translations).map(([lang, tr]) => [
          lang,
          stripInlineOptionsFromTranslation(tr as any),
        ]),
      )
    : q.translations;
  return { ...q, text, ...(q.translations ? { translations } : {}) };
}
