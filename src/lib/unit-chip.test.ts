import { describe, expect, it } from 'vitest';
import { shortEnglishName, shortTamilName, unitChipLabel } from '@/lib/unit-chip';
import { TNPSC_GROUPS, stageUnits } from '@/config/tnpsc';

describe('shortEnglishName', () => {
  it('leaves a short name alone', () => {
    expect(shortEnglishName('General Science')).toBe('General Science');
    expect(shortEnglishName('Indian Polity')).toBe('Indian Polity');
  });

  it('cuts a long name at a word and says so', () => {
    expect(shortEnglishName('History, Culture of India, and Indian National Movement')).toBe('History, Culture of India…');
  });

  it('does not end on a joining word', () => {
    expect(shortEnglishName('Indian Economy and Development Administration in Tamil Nadu')).toBe('Indian Economy…');
  });

  it('keeps two units that begin alike apart', () => {
    const a = shortEnglishName('History, Culture of India, and Indian National Movement');
    const b = shortEnglishName('History, Culture, Heritage, and Socio-Political Movements of Tamil Nadu');
    expect(a).not.toBe(b);
  });

  it('copes with a single very long word', () => {
    expect(shortEnglishName('Pneumonoultramicroscopicsilicovolcanoconiosis', 10)).toBe('Pneumonoul…');
  });
});

describe('shortTamilName', () => {
  it('takes the first clause of a dashed title', () => {
    expect(shortTamilName('வாசித்தல் – புரிந்து கொள்ளும் திறன்')).toBe('வாசித்தல்');
  });
});

describe('unitChipLabel', () => {
  it('shows a General Studies unit in English, though it carries a Tamil translation', () => {
    expect(unitChipLabel({ name: 'General Science', nameTa: 'பொது அறிவியல்' }, false)).toBe('General Science');
  });

  it('shows the Tamil paper in Tamil', () => {
    expect(unitChipLabel({ name: 'Grammar', nameTa: 'இலக்கணம்' }, true)).toBe('இலக்கணம்');
  });

  it('falls back to English where there is no Tamil name', () => {
    expect(unitChipLabel({ name: 'Grammar' }, true)).toBe('Grammar');
  });

  it('gives every General Studies unit a different chip', () => {
    const stage = TNPSC_GROUPS.find(g => g.id === 'group-4')!.stages[0];
    const gs = stageUnits(stage).filter(u => u.sectionName === 'General Studies');
    const labels = gs.map(u => unitChipLabel({ name: u.unit.name, nameTa: u.unit.name_ta }, false));
    expect(new Set(labels).size).toBe(gs.length);
    expect(labels.every(l => !/[஀-௿]/.test(l))).toBe(true); // no Tamil script
  });
});
