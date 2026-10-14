/**
 * Reading a question's options and its stored answers.
 *
 * Extracted from the diagnostic report so the shorter practice report can show
 * the same thing. The parsing is not obvious and must not be reimplemented: the
 * payload uses three different shapes for options depending on how the question
 * was ingested, and the answer is a letter that has to be matched back against
 * whichever of them came through.
 *
 *   - `["Delhi", "Mumbai"]`                      — an array of strings
 *   - `[{text, image_url}, …]`                   — an array of objects
 *   - `{A: "Delhi", B: "Mumbai"}`                — the legacy letter map
 *
 * Plus a fourth that is not a shape so much as an accident: an image option
 * serialised by Python's `str()` rather than as JSON, which arrives as the
 * literal text `{'text': None, 'image_url': '/static/…'}`.
 */
import { parseOptionRepr } from '@/lib/question-text';

export const OPTION_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];
export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export interface ResolvedOption {
  label: string;
  text: string | null;
  image_url: string | null;
}

export interface ListedOption extends ResolvedOption {
  /** The same option in the paper's other language, where one was sent. */
  translated: string | null;
}

/** True if the string is an image path/URL, so it renders as a picture not text. */
export function isImageUrl(s: string): boolean {
  return (
    /^\/static\//i.test(s) ||
    /\.(png|jpe?g|webp|gif|svg)(\?|#|$)/i.test(s) ||
    (/^https?:\/\//i.test(s) && /\.(png|jpe?g|webp|gif|svg)/i.test(s))
  );
}

/** Look up an option by letter — supports an array (indexed) or a `{A: …}` map. */
export function optionAt(options: unknown, key: string, idx: number): any {
  if (Array.isArray(options)) return idx >= 0 ? options[idx] : undefined;
  if (options && typeof options === 'object') {
    const map = options as Record<string, unknown>;
    return map[key?.toUpperCase()] ?? map[key] ?? undefined;
  }
  return undefined;
}

/** One stored answer — "b" — as the label and text the aspirant actually saw. */
export function resolveAnswerLabel(key: string | null, options: unknown): ResolvedOption {
  if (!key) return { label: '—', text: null, image_url: null };
  const idx = OPTION_LETTERS.indexOf(key.toLowerCase());
  const label = idx >= 0 ? OPTION_LABELS[idx] : key.toUpperCase();
  const opt = optionAt(options, key, idx);

  if (opt && typeof opt === 'object') {
    return { label, text: opt.text ?? null, image_url: opt.image_url ?? opt.imageUrl ?? null };
  }

  // An image option serialised by Python's str() rather than as JSON — the URL is
  // in there, so recover it instead of printing the dict.
  const rich = parseOptionRepr(opt);
  if (rich) return { label, text: rich.text, image_url: rich.image_url };

  if (opt != null && opt !== '') {
    const raw = String(opt);
    if (isImageUrl(raw)) return { label, text: null, image_url: raw };
    // Options are often stored already lettered ("b) Mumbai"); the label is drawn
    // separately, so the prefix would otherwise appear twice.
    return { label, text: raw.replace(/^[A-Fa-f][.)]\s*/, '').trim() || raw, image_url: null };
  }
  return { label, text: null, image_url: null };
}

/**
 * Every option a question offered, in order.
 *
 * Showing only the two answers — the one chosen and the right one — is enough to
 * mark a question but not enough to learn from it. Seeing the ones you did *not*
 * pick is how you work out what the trap was.
 */
export function allOptions(options: unknown, translated?: string[] | null): ListedOption[] {
  const keys = Array.isArray(options)
    ? options.map((_, i) => i)
    : options && typeof options === 'object'
      ? OPTION_LETTERS.map((_, i) => i).filter(i => optionAt(options, OPTION_LETTERS[i], i) != null)
      : [];

  return keys.map(i => {
    const raw = optionAt(options, OPTION_LETTERS[i], i);
    const label = OPTION_LABELS[i] ?? String(i + 1);
    // The translation rides alongside rather than replacing the text: the stored
    // answer is matched against the primary language.
    let tr = translated?.[i] ?? null;
    if (tr != null && String(tr).trim() === String(raw ?? '').trim()) tr = null;

    if (raw && typeof raw === 'object') {
      return {
        label,
        text: raw.text ?? null,
        image_url: raw.image_url ?? raw.imageUrl ?? null,
        translated: tr,
      };
    }
    const rich = parseOptionRepr(raw);
    if (rich) return { label, text: rich.text, image_url: rich.image_url, translated: tr };
    const str = raw == null ? '' : String(raw);
    if (isImageUrl(str)) return { label, text: null, image_url: str, translated: tr };
    return {
      label,
      text: str.replace(/^[A-Fa-f][.)]\s*/, '').trim() || str || null,
      image_url: null,
      translated: tr,
    };
  });
}

/** Which option letter a stored answer refers to, normalised for comparison. */
export function answerKeyOf(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** True when this listed option is the one the given answer points at. */
export function isAnswer(option: ListedOption, answer: string | null | undefined): boolean {
  const key = answerKeyOf(answer);
  if (!key) return false;
  return option.label.toLowerCase() === key || OPTION_LABELS.indexOf(option.label) === OPTION_LETTERS.indexOf(key);
}
