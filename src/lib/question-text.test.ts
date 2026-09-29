import { describe, expect, it } from 'vitest';
import { normaliseLineBreaks } from './question-text';

/**
 * Explanations are written in paragraphs — the answer, the concept, then why
 * each distractor is wrong. Those breaks have to survive the trip to the screen,
 * or the reader is handed one unbroken wall of text.
 */
describe('normaliseLineBreaks', () => {
  it('keeps real newlines, which the render site then shows', () => {
    expect(normaliseLineBreaks('First line.\n\nSecond line.')).toBe('First line.\n\nSecond line.');
  });

  it('repairs a literal backslash-n left by a double JSON encoding', () => {
    expect(normaliseLineBreaks('First line.\\n\\nSecond line.')).toBe('First line.\n\nSecond line.');
  });

  it('normalises Windows line endings, in both real and escaped form', () => {
    expect(normaliseLineBreaks('One.\r\nTwo.')).toBe('One.\nTwo.');
    expect(normaliseLineBreaks('One.\\r\\nTwo.')).toBe('One.\nTwo.');
  });

  it('caps a run of blank lines at one, so a stray gap cannot open a hole', () => {
    expect(normaliseLineBreaks('One.\n\n\n\n\nTwo.')).toBe('One.\n\nTwo.');
  });

  it('trims the ends without touching the breaks between', () => {
    expect(normaliseLineBreaks('\n\n  Body.\n\nMore.\n\n')).toBe('Body.\n\nMore.');
  });

  it('returns an empty string for nothing, rather than throwing', () => {
    expect(normaliseLineBreaks(null)).toBe('');
    expect(normaliseLineBreaks(undefined)).toBe('');
    expect(normaliseLineBreaks('')).toBe('');
  });

  it('leaves Tamil text and its bullets intact', () => {
    const src = 'சரியான விடை: (A)\\n\\n• அறம் முதலில்\\n• பொருள் இரண்டாவது';
    expect(normaliseLineBreaks(src)).toBe('சரியான விடை: (A)\n\n• அறம் முதலில்\n• பொருள் இரண்டாவது');
  });
});
