import { describe, expect, it } from 'vitest';
import {
  DASH,
  attemptStatus,
  formatDate,
  formatDateTime,
  formatDuration,
  formatPercent,
  formatScore,
  promoScope,
} from './admin-history-format';

describe('formatDateTime — IST', () => {
  it('shows an instant with an offset in IST', () => {
    expect(formatDateTime('2026-10-22T19:40:11+05:30')).toBe('22 Oct 2026, 7:40 PM');
    // The same instant written in UTC reads the same in IST.
    expect(formatDateTime('2026-10-22T14:10:11Z')).toBe('22 Oct 2026, 7:40 PM');
  });

  it('reads a time with no offset as IST wall time, not as the browser’s', () => {
    expect(formatDateTime('2026-10-20T11:02:00')).toBe('20 Oct 2026, 11:02 AM');
  });

  it('is a dash for nothing, and for something that is not a date', () => {
    expect(formatDateTime(null)).toBe(DASH);
    expect(formatDateTime('')).toBe(DASH);
    expect(formatDateTime('soon')).toBe(DASH);
  });

  it('has a date-only form', () => {
    expect(formatDate('2026-09-02T10:15:00')).toBe('2 Sep 2026');
    expect(formatDate(null)).toBe(DASH);
  });
});

describe('formatDuration', () => {
  it('is hours and minutes for a long test, minutes for a short one', () => {
    expect(formatDuration(10791)).toBe('2h 59m');
    expect(formatDuration(10800)).toBe('3h 0m');
    expect(formatDuration(1500)).toBe('25m');
    expect(formatDuration(40)).toBe('40s');
  });

  it('is a dash while the test is in progress, or when the figure is unusable', () => {
    expect(formatDuration(null)).toBe(DASH);
    expect(formatDuration(undefined)).toBe(DASH);
    expect(formatDuration(-5)).toBe(DASH);
    expect(formatDuration(Number.NaN)).toBe(DASH);
  });
});

describe('attempt status', () => {
  it('names the three the server sends', () => {
    expect(attemptStatus('submitted').label).toBe('Completed');
    expect(attemptStatus('auto_submitted').label).toBe('Auto-submitted (time up)');
    expect(attemptStatus('in_progress').label).toBe('In progress');
  });

  it('shows an unknown status as it came rather than hiding it', () => {
    expect(attemptStatus('abandoned').label).toBe('abandoned');
  });
});

describe('score and percentage', () => {
  it('are dashes when the attempt has none', () => {
    expect(formatScore(null)).toBe(DASH);
    expect(formatPercent(null)).toBe(DASH);
  });

  it('keep a sensible number of decimals', () => {
    expect(formatScore(142.5)).toBe('142.5');
    expect(formatScore(7)).toBe('7');
    expect(formatPercent(71.25)).toBe('71.3%');
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('promoScope', () => {
  it('reads like a label', () => {
    expect(promoScope('subscription')).toBe('Subscription');
    expect(promoScope('mock_unlock')).toBe('Mock unlock');
    expect(promoScope(null)).toBe(DASH);
  });
});
