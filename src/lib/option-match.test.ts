import { describe, expect, it } from 'vitest';
import { matchOptionIndex } from './option-match';

const opt = (label: string, text: string | null) => ({ label, text });

describe('matchOptionIndex', () => {
  // The paper in the bug report: Q14's options are themselves the letters D, A, B, C.
  const letters = [opt('A', 'D'), opt('B', 'A'), opt('C', 'B'), opt('D', 'C')];

  it('selects exactly one option when an answer’s text is also another option’s letter', () => {
    // "A" is the text of option B and the letter of option A — only option B was clicked.
    expect(matchOptionIndex(letters, 'A')).toBe(1);
    expect(matchOptionIndex(letters, 'D')).toBe(0);
    expect(matchOptionIndex(letters, 'B')).toBe(2);
    expect(matchOptionIndex(letters, 'C')).toBe(3);
  });

  it('matches an ordinary answer by its text, ignoring case and spacing', () => {
    const o = [opt('A', 'Paris'), opt('B', 'Rome')];
    expect(matchOptionIndex(o, 'Rome')).toBe(1);
    expect(matchOptionIndex(o, '  rome ')).toBe(1);
  });

  it('still reads the older forms: a position, and a letter', () => {
    const o = [opt('A', 'Paris'), opt('B', 'Rome'), opt('C', 'Oslo')];
    expect(matchOptionIndex(o, 2)).toBe(2);
    expect(matchOptionIndex(o, 'c')).toBe(2);
  });

  it('falls back to the letter only when no option has that text', () => {
    expect(matchOptionIndex([opt('A', 'x'), opt('B', 'y')], 'B')).toBe(1);
  });

  it('is -1 for no answer, or one that names nothing', () => {
    const o = [opt('A', 'Paris')];
    for (const v of [undefined, null, '', 'zzz', 9]) expect(matchOptionIndex(o, v)).toBe(-1);
  });

  it('matches an image option, which has no text, by its letter or position', () => {
    const o = [opt('A', null), opt('B', null)];
    expect(matchOptionIndex(o, 'B')).toBe(1);
    expect(matchOptionIndex(o, 0)).toBe(0);
  });
});
