/**
 * Editable site text.
 *
 * Every piece of copy an admin can change is a *field*: a key, a label for the admin screen, and the built-in text
 * (`default`) that shows until the admin sets something else. A screen reads a field with `useT()` (see `./useText`) —
 * never a bare string — so the page looks exactly as it did until someone edits it, and keeps working when the server
 * has no setting or is unreachable.
 *
 * One file per screen group (`landing.ts`, `auth.ts`, …) calls `defineContent`, and `./index` gathers them. The admin
 * screen (Admin Settings → Site content) lists the groups and their fields straight from here — add a field and it appears.
 */
export interface ContentField {
  /** What the admin sees: "Hero heading", "Empty state — no attempts". Say where it shows. */
  label: string;
  /** The built-in text. Must be exactly what the screen showed before it became editable. */
  default: string;
  /** Show a multi-line box in the admin (a paragraph) instead of a one-line input. */
  multiline?: boolean;
  /** Placeholders the text may use, written `{name}` — the admin is told which ones, and the screen fills them in. */
  vars?: string[];
  /** One line of help under the box ("Shown under the hero heading"). */
  hint?: string;
}

export interface ContentGroup<F extends Record<string, ContentField> = Record<string, ContentField>> {
  /** The screen or area, as the admin sees it: "Landing page", "Sign in & register". */
  group: string;
  fields: F;
}

/** Declare a group's fields. Keys are `area.section.name`, lower-case with dots: `landing.hero.title`. */
export function defineContent<F extends Record<string, ContentField>>(group: string, fields: F): ContentGroup<F> {
  return { group, fields };
}
