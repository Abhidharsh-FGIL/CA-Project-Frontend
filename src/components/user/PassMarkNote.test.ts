import { describe, expect, it } from 'vitest';
import { officialBody } from './PassMarkNote';

describe('officialBody', () => {
  it('names the RRB NTPC test a paper belongs to', () => {
    expect(officialBody('RRB NTPC CBT-1 (Under-Graduate · English) — Full Mock')).toBe('RRB NTPC CBT-1 (UG)');
    expect(officialBody('RRB NTPC CBT-1 (Graduate · Tamil) — Full Mock')).toBe('RRB NTPC CBT-1 (Graduate)');
    expect(officialBody('RRB NTPC CBT-1 — Full Mock')).toBe('RRB NTPC CBT-1');
    expect(officialBody('RRB NTPC CBT-2 (Graduate · Hindi) — Current Events · Simple')).toBe('RRB NTPC CBT-2');
  });

  it('keeps TNPSC for every other paper', () => {
    expect(officialBody('TNPSC Group 4 — Full Mock')).toBe('TNPSC');
    expect(officialBody('Grammar · Mixed')).toBe('TNPSC');
    expect(officialBody(null)).toBe('TNPSC');
  });
});
