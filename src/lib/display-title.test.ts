import { describe, expect, it } from 'vitest';
import { displayTitle } from '@/lib/display-title';

describe('displayTitle', () => {
  it('drops the exam prefix', () => {
    expect(displayTitle('TNPSC Group 4 — இலக்கணம் · Medium')).toBe('இலக்கணம் · Medium');
    expect(displayTitle('TNPSC Group 1 – Indian Polity · Mixed')).toBe('Indian Polity · Mixed');
    expect(displayTitle('GAT-B — Section A · Simple')).toBe('Section A · Simple');
    expect(displayTitle('TNPSC Group 2 Prelims — Reasoning · Mixed')).toBe('Reasoning · Mixed');
  });

  it('leaves other titles and empty values alone', () => {
    expect(displayTitle('Unit Test 1 — Revision')).toBe('Unit Test 1 — Revision');
    expect(displayTitle('TNPSC Group 4 — Full Mock (English)')).toBe('Full Mock (English)');
    expect(displayTitle(null)).toBeNull();
    expect(displayTitle('')).toBe('');
  });
});
