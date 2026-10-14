import { describe, expect, it } from 'vitest';
import { attemptOutcome, durationLabel, isUnfinished, scoreTone } from './attempt-history';

const START = '2026-10-13T10:00:00.000Z';
const at = (minutes: number, seconds = 0) => new Date(new Date(START).getTime() + (minutes * 60 + seconds) * 1000).toISOString();

describe('isUnfinished', () => {
  it('counts an attempt still in progress', () => {
    expect(isUnfinished({ status: 'in_progress', percentage: null })).toBe(true);
  });

  it('counts a submitted attempt that recorded no score', () => {
    expect(isUnfinished({ status: 'submitted', percentage: null })).toBe(true);
  });

  it('does not count a scored attempt — a 0% is still a score', () => {
    expect(isUnfinished({ status: 'submitted', percentage: 0 })).toBe(false);
  });
});

describe('attemptOutcome', () => {
  it('is completed for a scored, manually submitted attempt', () => {
    expect(attemptOutcome({ status: 'submitted', percentage: 40, auto_submitted: false })).toBe('completed');
  });

  it('is auto-submitted when the timer ended it', () => {
    expect(attemptOutcome({ status: 'auto_submitted', percentage: 7, auto_submitted: true })).toBe('auto-submitted');
  });

  it('is unfinished whenever nothing was scored, even if flagged auto-submitted', () => {
    expect(attemptOutcome({ status: 'in_progress', percentage: null, auto_submitted: false })).toBe('unfinished');
    expect(attemptOutcome({ status: 'auto_submitted', percentage: null, auto_submitted: true })).toBe('unfinished');
  });
});

describe('durationLabel', () => {
  it('rounds to whole minutes', () => {
    expect(durationLabel({ start_time: START, end_time: at(11, 20) })).toBe('11 min');
    expect(durationLabel({ start_time: START, end_time: at(219) })).toBe('219 min');
  });

  it('says "< 1 min" under a minute', () => {
    expect(durationLabel({ start_time: START, end_time: at(0, 40) })).toBe('< 1 min');
  });

  it('is null with no end time, or an end before the start', () => {
    expect(durationLabel({ start_time: START, end_time: null })).toBeNull();
    expect(durationLabel({ start_time: START, end_time: at(-5) })).toBeNull();
    expect(durationLabel({ start_time: START, end_time: START })).toBeNull();
  });

  it('is null for a timestamp it cannot read', () => {
    expect(durationLabel({ start_time: START, end_time: 'not a date' })).toBeNull();
  });
});

describe('scoreTone', () => {
  it('bands at 50 and 70', () => {
    expect(scoreTone(100)).toBe('high');
    expect(scoreTone(70)).toBe('high');
    expect(scoreTone(69.9)).toBe('mid');
    expect(scoreTone(50)).toBe('mid');
    expect(scoreTone(49.9)).toBe('low');
    expect(scoreTone(0)).toBe('low');
  });
});
