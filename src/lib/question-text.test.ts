import { describe, expect, it } from 'vitest';
import { normaliseLineBreaks, splitExplanationSteps } from './question-text';

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

/**
 * The Group 4 explanations arrive as "Step 1 - … Step 6 - …" in one run of
 * prose. Split, they read as a worked answer; unsplit, as a wall of text.
 */
describe('splitExplanationSteps', () => {
  const src =
    'Step 1 - Understand the question: It asks for the AI system. ' +
    'Step 2 - Concept: AI simulates human intelligence. ' +
    'Step 3 - Key facts / working: Railways uses sensors. ' +
    'Step 4 - Check each option: (A) Hatti port - wrong because it is unrelated. ' +
    '(B) Radio galaxy - wrong because it is astronomical. ' +
    '(C) Gajraj Suraksha - correct because it is the AI system. ' +
    'Step 5 - Answer: The correct option is C. ' +
    'Step 6 - Remember: AI is widely used.';

  it('splits numbered steps and lifts the title before the colon', () => {
    const r = splitExplanationSteps(src)!;
    expect(r.steps).toHaveLength(6);
    expect(r.steps[0]).toMatchObject({ n: 1, title: 'Understand the question', body: 'It asks for the AI system.' });
    expect(r.steps[2].title).toBe('Key facts / working');
    expect(r.steps[5]).toMatchObject({ n: 6, title: 'Remember' });
  });

  it('turns the option walk-through into one entry per option, with its verdict', () => {
    const step4 = splitExplanationSteps(src)!.steps[3];
    expect(step4.title).toBe('Check each option');
    expect(step4.body).toBe('');
    expect(step4.options.map(o => [o.label, o.verdict])).toEqual([
      ['A', 'wrong'],
      ['B', 'wrong'],
      ['C', 'correct'],
    ]);
    expect(step4.options[2].text).toBe('Gajraj Suraksha - correct because it is the AI system.');
  });

  it('keeps anything written before Step 1 as the intro', () => {
    const r = splitExplanationSteps('Quick note. Step 1 - Idea: One. Step 2 - Answer: Two.')!;
    expect(r.intro).toBe('Quick note.');
    expect(r.steps).toHaveLength(2);
  });

  it('works on newline-separated steps too', () => {
    expect(splitExplanationSteps('Step 1 - A: one\nStep 2 - B: two')!.steps).toHaveLength(2);
  });

  it('leaves ordinary prose alone', () => {
    expect(splitExplanationSteps('The first step is to read the question.')).toBeNull();
    expect(splitExplanationSteps('Step 1 - only one step here.')).toBeNull();
    expect(splitExplanationSteps('Step 2 - a. Step 3 - b.')).toBeNull();
    expect(splitExplanationSteps(null)).toBeNull();
  });
});
