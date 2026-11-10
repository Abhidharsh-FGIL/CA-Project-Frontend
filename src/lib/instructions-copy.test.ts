import { describe, expect, it } from 'vitest';
import { instructionCopy, instructionLang } from './instructions-copy';

describe('instructionLang — the paper’s language from its title', () => {
  it('is Tamil when the title names Tamil, even beside a Tamil subject name', () => {
    expect(instructionLang('RRB NTPC CBT-1 (Under-Graduate · Tamil) — Current Events / நடப்பு நிகழ்வுகள் · Simple')).toBe('ta');
    expect(instructionLang('TNPSC Group 4 — தமிழ் இலக்கணம்')).toBe('ta');
    expect(instructionLang('குரூப் 4 மாதிரி தேர்வு')).toBe('ta');
  });
  it('is Hindi when the title names Hindi or is in Devanagari', () => {
    expect(instructionLang('RRB NTPC CBT-1 (Under-Graduate · Hindi) — समसामयिक घटनाएँ · Simple')).toBe('hi');
    expect(instructionLang('सामान्य ज्ञान अभ्यास')).toBe('hi');
  });
  it('is English otherwise', () => {
    expect(instructionLang('TNPSC Group 4 — Aptitude · Mixed')).toBe('en');
    expect(instructionLang('TNPSC Group 4 — General Science / பொது அறிவியல்')).toBe('en');
    expect(instructionLang(null)).toBe('en');
  });
});

describe('instructionCopy', () => {
  it('has the same lines in both languages', () => {
    const en = instructionCopy('en');
    const ta = instructionCopy('ta');
    for (const k of Object.keys(en) as Array<keyof typeof en>) {
      if (typeof en[k] === 'string') {
        expect(ta[k]).not.toBe(en[k]);
        expect(instructionCopy('hi')[k]).not.toBe(en[k]);
      }
    }
    expect(instructionCopy('hi').negativeFlat(0.25)).toContain('0.25');
    expect(ta.negativeFlat(0.25)).toContain('0.25');
    expect(ta.negativeBySection([{ section: 'A', value: 1 }])).toContain('A');
  });
});
