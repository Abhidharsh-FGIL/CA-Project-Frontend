import { describe, expect, it } from 'vitest';
import { langToggleOptions, resolveLanguage, translationCopy } from './question-language';

/**
 * The payload keeps the two languages apart — the paper's own stem, options and
 * explanation at the top level, the other language under `translations.<code>`.
 * Reading in one language means picking a side field by field.
 */
const bilingual = {
  body: 'A shopkeeper mixes 20 kg rice at ₹48/kg…',
  options: ['₹72', '₹66.24', '₹67.20'],
  explanation: 'Correct answer: B) ₹66.24\n\nSTEP 1 — …',
  translations: {
    ta: {
      text: '₹48/கி.கி. விலையில் 20 கி.கி. அரிசியையும்…',
      options: ['₹72', '₹66.24', '₹67.20'],
      explanation: 'சரியான விடை: ₹66.24\n\nபடி 1 — …',
    },
  },
};

const primaryOf = (q: any) => ({ text: q.body as string | null, options: q.options, explanation: q.explanation });

describe('langToggleOptions', () => {
  it('offers exactly two sides, the paper’s own language first', () => {
    expect(langToggleOptions('ta')).toEqual([
      { value: 'primary', label: 'English' },
      { value: 'translation', label: 'தமிழ்' },
    ]);
  });

  it('inverts for a Tamil paper carrying an English translation', () => {
    expect(langToggleOptions('en').map(o => o.label)).toEqual(['தமிழ்', 'English']);
  });
});

describe('resolveLanguage', () => {
  it('leaves the paper in its own language for the primary side', () => {
    const r = resolveLanguage<string | null>(bilingual, 'primary', primaryOf(bilingual));
    expect(r.text).toBe(bilingual.body);
    expect(r.options).toBe(bilingual.options);
    expect(r.explanation).toBe(bilingual.explanation);
    expect(r.usedFallback).toBe(false);
  });

  it('switches the stem, the options AND the explanation together', () => {
    // The options list used to stay in the paper's own language however the
    // control was set, so a Tamil reader got a Tamil question with English choices.
    const r = resolveLanguage<string | null>(bilingual, 'translation', primaryOf(bilingual));
    expect(r.text).toBe(bilingual.translations.ta.text);
    expect(r.options).toBe(bilingual.translations.ta.options);
    expect(r.explanation).toBe(bilingual.translations.ta.explanation);
    expect(r.usedFallback).toBe(false);
  });

  it('keeps the stacked view untouched in both mode', () => {
    const r = resolveLanguage<string | null>(bilingual, 'both', primaryOf(bilingual));
    expect(r.text).toBe(bilingual.body);
    expect(r.options).toBe(bilingual.options);
  });

  it('falls back field by field rather than blanking what has no translation', () => {
    // A Tamil stem with no Tamil explanation is common. Hiding the explanation
    // because the reader asked for Tamil loses the only copy there is.
    const partial = { ...bilingual, translations: { ta: { text: 'தமிழ் வினா', options: [] as string[] } } };
    const r = resolveLanguage<string | null>(partial, 'translation', primaryOf(partial));
    expect(r.text).toBe('தமிழ் வினா');
    expect(r.options).toBe(partial.options);
    expect(r.explanation).toBe(partial.explanation);
    expect(r.usedFallback).toBe(true);
  });

  it('falls back entirely for a paper with an empty translation block', () => {
    const none = { ...bilingual, translations: { ta: {} } };
    const r = resolveLanguage<string | null>(none, 'translation', primaryOf(none));
    expect(r.text).toBe(none.body);
    expect(r.options).toBe(none.options);
    expect(r.explanation).toBe(none.explanation);
    expect(r.usedFallback).toBe(true);
  });

  it('treats whitespace-only translation text as absent', () => {
    const blank = { ...bilingual, translations: { ta: { text: '   ', explanation: '\n' } } };
    const r = resolveLanguage<string | null>(blank, 'translation', primaryOf(blank));
    expect(r.text).toBe(blank.body);
    expect(r.explanation).toBe(blank.explanation);
  });
});

/**
 * Every exporter prints the second language from the same three fields. An export
 * that read `translations` itself — or never read it — is how a Tamil paper came
 * out English-only.
 */
describe('translationCopy', () => {
  it('returns the Tamil stem, options and explanation, labelled', () => {
    const tr = translationCopy(bilingual)!;
    expect(tr.lang).toBe('ta');
    expect(tr.label).toBe('தமிழ்');
    expect(tr.text).toBe('₹48/கி.கி. விலையில் 20 கி.கி. அரிசியையும்…');
    expect(tr.options).toEqual(['₹72', '₹66.24', '₹67.20']);
    expect(tr.explanation).toContain('சரியான விடை');
  });

  it('accepts options written as { text } objects', () => {
    const q = { translations: { ta: { text: 'கேள்வி', options: [{ text: 'அ' }, { text: 'ஆ' }] } } };
    expect(translationCopy(q)!.options).toEqual(['அ', 'ஆ']);
  });

  it('is null for a single-language question, so those export exactly as before', () => {
    expect(translationCopy({ text: 'English only' })).toBeNull();
    expect(translationCopy({ translations: { ta: {} } })).toBeNull();
    expect(translationCopy(null)).toBeNull();
  });
});
