import { afterEach, describe, expect, it } from 'vitest';
import { LEVEL_PASS_PERCENTAGE } from './tnpsc';
import {
  PASS_MARKS,
  applyPassMarks,
  levelFromTitle,
  levelKey,
  mockPassPercentage,
  parsePassMarks,
  passMarkFor,
  passMarks,
  performanceOf,
  resetPassMarks,
  standingOf,
} from './pass-marks';

describe('pass marks', () => {
  it('holds each kind of paper to its own benchmark', () => {
    expect(passMarkFor({ kind: 'practice', level: 'simple' })).toEqual({ pass: 70, target: 85 });
    expect(passMarkFor({ kind: 'practice', level: 'medium' })).toEqual({ pass: 60, target: 75 });
    expect(passMarkFor({ kind: 'practice', level: 'complex' })).toEqual({ pass: 50, target: 65 });
    expect(passMarkFor({ kind: 'practice', level: 'mixed' })).toEqual({ pass: 60, target: 75 });
    expect(passMarkFor({ kind: 'mock' })).toEqual({ pass: 60, target: 75 });
  });

  it('reads every spelling of a difficulty, and treats a paper that names none as mixed', () => {
    expect(['easy', 'Simple'].map(levelKey)).toEqual(['simple', 'simple']);
    expect(['hard', 'Difficult', 'complex'].map(levelKey)).toEqual(['complex', 'complex', 'complex']);
    expect(['moderate', 'MEDIUM'].map(levelKey)).toEqual(['medium', 'medium']);
    expect([undefined, null, '', 'whatever'].map(levelKey)).toEqual(['mixed', 'mixed', 'mixed', 'mixed']);
  });

  it('turns the full-length mock benchmark into marks: 180 and 225 out of 300', () => {
    expect(passMarks(PASS_MARKS.mock, 300)).toEqual({ pass: 180, target: 225 });
    expect(passMarks(PASS_MARKS.simple, 30)).toEqual({ pass: 21, target: 26 });
    expect(passMarks(PASS_MARKS.mock, null)).toBeNull();
    expect(passMarks(PASS_MARKS.mock, 0)).toBeNull();
  });

  it('places a score against the benchmark', () => {
    const medium = PASS_MARKS.medium;
    expect([80, 75, 74.9, 60, 59.9, 45, 44.9, 0].map(p => standingOf(p, medium))).toEqual([
      'target', 'target', 'pass', 'pass', 'close', 'close', 'below', 'below',
    ]);
    expect(standingOf(null, medium)).toBeNull();
  });

  it('the same score is read differently by difficulty', () => {
    expect(standingOf(65, PASS_MARKS.simple)).toBe('close'); // short of 70
    expect(standingOf(65, PASS_MARKS.complex)).toBe('target'); // meets the 65 target
  });

  it('reads the difficulty off a title', () => {
    expect(levelFromTitle('Grammar · Medium')).toBe('medium');
    expect(levelFromTitle('TNPSC Group 4 — Translation · Mixed')).toBe('mixed');
    expect(levelFromTitle('Mixed Bag of Questions')).toBeUndefined();
    expect(levelFromTitle(null)).toBeUndefined();
  });

  it('the bundled level-clearing mark for mocks is the mock benchmark', () => {
    expect(LEVEL_PASS_PERCENTAGE).toBe(PASS_MARKS.mock.pass);
  });
});

describe('pass marks from the server', () => {
  afterEach(() => resetPassMarks());

  it('reads a table of { pass, target } by difficulty, bare or under pass_marks', () => {
    const body = { simple: { pass: 75, target: 90 }, complex: { pass: 45, target: 60 }, mock: { pass: 55, target: 70 } };
    for (const raw of [body, { pass_marks: body }]) {
      const t = parsePassMarks(raw)!;
      expect(t.simple).toEqual({ pass: 75, target: 90 });
      expect(t.complex).toEqual({ pass: 45, target: 60 });
      expect(t.mock).toEqual({ pass: 55, target: 70 });
      // what the server did not send keeps the bundled value
      expect(t.medium).toEqual(PASS_MARKS.medium);
      expect(t.mixed).toEqual(PASS_MARKS.mixed);
    }
  });

  it('accepts the other spellings: easy / hard / full_mock, pass_percentage, and a bare number', () => {
    const t = parsePassMarks({
      easy: { pass_percentage: 72, target_percentage: 88 },
      hard: 48,
      full_mock: { pass: 62, target: 78 },
    })!;
    expect(t.simple).toEqual({ pass: 72, target: 88 });
    expect(t.complex.pass).toBe(48);
    expect(t.mock).toEqual({ pass: 62, target: 78 });
  });

  it('ignores an entry that is not a sensible percentage, and says nothing at all when none is', () => {
    expect(parsePassMarks({ simple: { pass: 150 }, medium: { pass: -5 }, complex: 'high' })).toBeNull();
    expect(parsePassMarks({ simple: { pass: 80, target: 90 }, medium: { pass: 'x' } })!.medium).toEqual(PASS_MARKS.medium);
    for (const raw of [null, undefined, 'nope', 5, {}, []]) expect(parsePassMarks(raw)).toBeNull();
  });

  it('lifts a target that sits under its pass mark', () => {
    expect(parsePassMarks({ simple: { pass: 90, target: 60 } })!.simple.target).toBeGreaterThanOrEqual(90);
  });

  it('once applied, the server’s marks are the ones used — for the verdict and for a mock clearing a level', () => {
    applyPassMarks(parsePassMarks({ medium: { pass: 40, target: 55 }, mock: { pass: 50, target: 65 } })!);
    expect(passMarkFor({ kind: 'practice', level: 'medium' })).toEqual({ pass: 40, target: 55 });
    expect(passMarkFor({ kind: 'mock' })).toEqual({ pass: 50, target: 65 });
    expect(mockPassPercentage()).toBe(50);
    resetPassMarks();
    expect(mockPassPercentage()).toBe(60);
  });
});

describe('performanceOf', () => {
  const mark = { pass: 70, target: 85 };
  it('reads a score against the benchmark in four steps', () => {
    expect(performanceOf(69.9, mark)).toBe('needs-improvement');
    expect(performanceOf(70, mark)).toBe('passed');
    expect(performanceOf(84.9, mark)).toBe('passed');
    expect(performanceOf(85, mark)).toBe('strong');
    expect(performanceOf(89.9, mark)).toBe('strong');
    expect(performanceOf(90, mark)).toBe('excellent');
    expect(performanceOf(null, mark)).toBeNull();
  });
});
