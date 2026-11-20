import { describe, expect, it } from 'vitest';
import { DEFAULT_LIVE_EXAMS, joinExamNames, liveExamsFromSettings, parseLiveExams } from './landing-settings';

describe('parseLiveExams', () => {
  it('reads one exam a line, trimmed, without blanks or repeats', () => {
    expect(parseLiveExams('  TNPSC Group 4 & 2 \n\nRRB NTPC CBT-1 (UG & Graduate)\r\ntnpsc group 4 & 2')).toEqual([
      'TNPSC Group 4 & 2',
      'RRB NTPC CBT-1 (UG & Graduate)',
    ]);
  });
  it('accepts a list and keeps at most four', () => {
    expect(parseLiveExams(['a', 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd']);
  });
  it('ignores anything else', () => {
    expect(parseLiveExams(null)).toEqual([]);
    expect(parseLiveExams(5)).toEqual([]);
    expect(parseLiveExams([1, 'ok'])).toEqual(['ok']);
  });
});

describe('liveExamsFromSettings', () => {
  it('uses the server list', () => {
    expect(liveExamsFromSettings({ live_exams: ['Group 4', 'NTPC'] })).toEqual(['Group 4', 'NTPC']);
    expect(liveExamsFromSettings({ live_exams: 'Group 4\nNTPC' })).toEqual(['Group 4', 'NTPC']);
  });
  it('falls back to the built-in list, which includes Graduate', () => {
    expect(liveExamsFromSettings(null)).toBe(DEFAULT_LIVE_EXAMS);
    expect(liveExamsFromSettings({ live_exams: [] })).toBe(DEFAULT_LIVE_EXAMS);
    expect(DEFAULT_LIVE_EXAMS.join(' ')).toMatch(/Graduate/);
  });
});

describe('joinExamNames', () => {
  it('reads as a sentence', () => {
    expect(joinExamNames(['A'])).toBe('A');
    expect(joinExamNames(['A', 'B'])).toBe('A and B');
    expect(joinExamNames(['A', 'B', 'C'])).toBe('A, B and C');
  });
});
