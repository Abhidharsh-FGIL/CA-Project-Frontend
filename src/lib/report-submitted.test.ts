import { describe, expect, it } from 'vitest';
import { submittedLabel } from './report-submitted';

describe('submittedLabel', () => {
  it('gives the date and time of submission, in IST', () => {
    expect(submittedLabel({ submittedAt: '2026-10-22T14:10:11Z' })).toBe('Submitted 22 Oct 2026, 7:40 PM');
  });

  it('says when the timer submitted it', () => {
    expect(submittedLabel({ submittedAt: '2026-10-22T19:40:00+05:30', autoSubmitted: true })).toBe('Auto-submitted 22 Oct 2026, 7:40 PM');
  });

  it('is nothing for an attempt with no submission time', () => {
    expect(submittedLabel({ submittedAt: null })).toBeNull();
    expect(submittedLabel({ submittedAt: 'not a date' })).toBeNull();
  });
});
