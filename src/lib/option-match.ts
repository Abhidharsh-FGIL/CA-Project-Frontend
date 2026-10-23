/**
 * Which one option a stored answer points at.
 *
 * An answer is stored as the option's *text* ("Paris"), and older data stores its letter ("B") or its
 * position (1). Checking each option against all three independently picks several at once when they
 * collide — a question whose options are the single letters "D", "A", "B", "C" has an option whose text
 * is "A" and, elsewhere, an option whose letter is "A". Both lit up, and the screen showed two answers
 * selected on a single-answer question.
 *
 * So the answer is resolved once, to one option, in order of how specific it is: the text, then a
 * position, then a letter. The first that finds an option wins and the rest are not consulted.
 */
export interface MatchableOption {
  text: string | null;
  label: string;
}

const same = (a: unknown, b: unknown) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/** The index of the option the value means, or -1 when it means none. */
export function matchOptionIndex(options: MatchableOption[], value: unknown): number {
  if (value === undefined || value === null || value === '') return -1;

  // The option's own text — what the app stores.
  if (typeof value === 'string' || typeof value === 'number') {
    const byText = options.findIndex(o => o.text != null && o.text !== '' && same(o.text, value));
    if (byText >= 0) return byText;
  }
  // A position, as a number.
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < options.length) return value;
  // A letter.
  if (typeof value === 'string') {
    const byLabel = options.findIndex(o => same(o.label, value));
    if (byLabel >= 0) return byLabel;
  }
  return -1;
}
