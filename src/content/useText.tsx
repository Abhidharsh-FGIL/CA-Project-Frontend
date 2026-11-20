import { Fragment, useCallback, type ReactNode } from 'react';
import { CONTENT_FIELDS, type ContentKey } from './registry';
import { currentOverrides, useSiteContent } from './store';

export type Vars = Record<string, string | number | null | undefined>;

/** Fill `{name}` placeholders. One that is not supplied is left as typed, so a typo in the admin is visible, not silent. */
export function fillVars(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = vars[name];
    return v == null ? whole : String(v);
  });
}

/** The text for a key: the admin's if set, else the built-in. Outside React (rare) — inside, use `useT`. */
export function textFor(key: ContentKey, vars?: Vars, overrides: Record<string, string> = currentOverrides()): string {
  const field = CONTENT_FIELDS[key];
  const own = overrides[key];
  return fillVars(own != null && own.trim() !== '' ? own : (field?.default ?? key), vars);
}

/**
 * `const t = useT();  t('landing.hero.lead')` — the text for a key, which draws again when the admin's text arrives.
 * Pass `vars` for `{placeholders}`: `t('landing.cta.join', { students, exams })`.
 */
export function useT(): (key: ContentKey, vars?: Vars) => string {
  const overrides = useSiteContent();
  return useCallback((key, vars) => textFor(key, vars, overrides), [overrides]);
}

/** One key, when a component needs just the one. */
export function useText(key: ContentKey, vars?: Vars): string {
  return useT()(key, vars);
}

/**
 * Text with a little emphasis markup, for headings: `*word*` becomes `<span>word</span>` (the page's own CSS colours it),
 * and a line break in the text is a line break on the page. Nothing else is interpreted — the text is never HTML.
 */
export function Rich({ text }: { text: string }): ReactNode {
  return (
    <>
      {text.split('\n').map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/(\*[^*\n]+\*)/g).map((part, pi) =>
            part.length > 2 && part.startsWith('*') && part.endsWith('*') ? <span key={pi}>{part.slice(1, -1)}</span> : <Fragment key={pi}>{part}</Fragment>,
          )}
        </Fragment>
      ))}
    </>
  );
}
