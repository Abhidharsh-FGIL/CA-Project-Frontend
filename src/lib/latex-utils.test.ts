import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { normalizeLatex, repairSwallowedEscapes } from './latex-utils';

describe('repairSwallowedEscapes', () => {
  it('puts back a "\\right" that a JSON "\\r" escape turned into a carriage return', () => {
    // As the paper arrived: "\right" read as CR + "ight".
    const broken = 'Find the value of $\\left(3 + \\frac{4}{3} \\text{ of } 2\\frac{1}{4}\rright)$.'.replace('\rright', '\right');
    const fixed = repairSwallowedEscapes(broken);
    expect(fixed).toBe('Find the value of $\\left(3 + \\frac{4}{3} \\text{ of } 2\\frac{1}{4}\\right)$.');
    expect(() => katex.renderToString(fixed.slice(fixed.indexOf('$') + 1, fixed.lastIndexOf('$')), { throwOnError: true })).not.toThrow();
  });

  it('repairs the other escapes a command can lose its backslash to', () => {
    expect(repairSwallowedEscapes('\frac{1}{2}')).toBe('\\frac{1}{2}');
    expect(repairSwallowedEscapes('\x08eta')).toBe('\\beta');
    expect(repairSwallowedEscapes('\x07lpha')).toBe('\\alpha');
    expect(repairSwallowedEscapes('\vec{v}')).toBe('\\vec{v}');
    expect(repairSwallowedEscapes('2\times 3')).toBe('2\\times 3');
    expect(repairSwallowedEscapes('a\neq b')).toBe('a\\neq b');
  });

  it('leaves ordinary line endings, tabs and newlines alone', () => {
    expect(repairSwallowedEscapes('line one\r\nline two')).toBe('line one\r\nline two');
    expect(repairSwallowedEscapes('name\tvalue')).toBe('name\tvalue');
    expect(repairSwallowedEscapes('first\nnext line')).toBe('first\nnext line');
  });

  it('runs as part of normalizeLatex, and twice is the same as once', () => {
    const once = normalizeLatex('$\\left(1\right)$');
    expect(once).toBe('$\\left(1\\right)$');
    expect(normalizeLatex(once)).toBe(once);
  });
});
