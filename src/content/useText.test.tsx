import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { fillVars, Rich, textFor } from './useText';
import { parseOverrides, resetSiteContent } from './store';
import { CONTENT_FIELDS, CONTENT_GROUPS } from './registry';

describe('fillVars', () => {
  it('fills placeholders and leaves unknown ones as typed', () => {
    expect(fillVars('Join {n} for {what}', { n: '2,000+' })).toBe('Join 2,000+ for {what}');
    expect(fillVars('plain')).toBe('plain');
  });
});

describe('parseOverrides', () => {
  it('reads { content } or a bare map, keeping non-empty strings only', () => {
    expect(parseOverrides({ content: { a: 'x', b: '  ', c: 5 } })).toEqual({ a: 'x' });
    expect(parseOverrides({ a: 'x' })).toEqual({ a: 'x' });
    expect(parseOverrides(null)).toEqual({});
  });
});

describe('textFor', () => {
  afterEach(() => resetSiteContent());
  it('falls back to the built-in text, and an override wins', () => {
    const key = Object.keys(CONTENT_FIELDS)[0];
    if (!key) return; // no fields registered yet
    expect(textFor(key as never)).toBe(CONTENT_FIELDS[key].default);
    resetSiteContent({ [key]: 'Edited' });
    expect(textFor(key as never)).toBe('Edited');
  });
});

describe('Rich', () => {
  it('turns *word* into a span and newlines into line breaks, never HTML', () => {
    expect(renderToStaticMarkup(<Rich text={'Your *Preparation* starts\n<b>here</b>'} />)).toBe('Your <span>Preparation</span> starts<br/>&lt;b&gt;here&lt;/b&gt;');
  });
});

describe('registry', () => {
  it('has no duplicate keys and every default is non-empty', () => {
    const seen = new Set<string>();
    for (const g of CONTENT_GROUPS)
      for (const [k, f] of Object.entries(g.fields)) {
        expect(seen.has(k), `duplicate key ${k}`).toBe(false);
        seen.add(k);
        expect(f.default.trim(), `${k} default`).not.toBe('');
        expect(f.label.trim(), `${k} label`).not.toBe('');
        // every {placeholder} in the default is declared in `vars`
        for (const m of f.default.matchAll(/\{(\w+)\}/g)) expect(f.vars ?? [], `${k} uses {${m[1]}}`).toContain(m[1]);
      }
  });
});
