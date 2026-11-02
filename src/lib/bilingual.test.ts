import { describe, expect, it } from 'vitest';
import { bilingual, bilingualTitle, otherName, studentTitle } from './bilingual';

describe('bilingual', () => {
  it('names a unit in both languages, English first, whichever language it arrives in', () => {
    expect(bilingual('Indian Polity')).toBe('Indian Polity / இந்திய அரசியலமைப்பு');
    // The language papers read in their own language only.
    expect(bilingual('இலக்கணம்')).toBe('இலக்கணம்');
    expect(bilingual('General Tamil')).toBe('பொதுத் தமிழ்');
    expect(bilingual('General English')).toBe('General English');
  });

  it('knows key topics and bank categories', () => {
    expect(bilingual('Physics')).toBe('Physics / இயற்பியல்');
    expect(bilingual('Environmental Science')).toBe('Environmental Science / சுற்றுச்சூழல் அறிவியல்');
    expect(bilingual('எழுத்திலக்கணம்')).toBe('எழுத்திலக்கணம்');
    expect(bilingual('Orthography')).toBe('எழுத்திலக்கணம்');
    expect(bilingual('hcf')).toBe('hcf / மீப்பெரு பொது வகுத்தி (மீ.பொ.வ)');
  });

  it('turns a printed topic with its gloss in brackets around', () => {
    expect(bilingual('பிரித்து எழுதுதல் (Splitting words)')).toBe('Splitting words / பிரித்து எழுதுதல்');
  });

  it('prefers a name the caller already has', () => {
    expect(bilingual('Geography', 'புவியியல் (இந்தியா)')).toBe('Geography / புவியியல் (இந்தியா)');
  });

  it('leaves an unknown or already bilingual name alone', () => {
    expect(bilingual('Something New')).toBe('Something New');
    expect(bilingual('Physics / இயற்பியல்')).toBe('Physics / இயற்பியல்');
    expect(bilingual('')).toBe('');
    expect(otherName('Something New')).toBeNull();
  });
});

describe('bilingualTitle', () => {
  it('translates each name in a title and keeps the level words', () => {
    expect(bilingualTitle('இலக்கணம்: எழுத்திலக்கணம் · Mixed')).toBe('இலக்கணம்: எழுத்திலக்கணம் · Mixed');
    expect(bilingualTitle('Aptitude · Simple')).toBe('Aptitude / திறனறிவு · Simple');
  });

  it('drops the exam prefix for students', () => {
    expect(studentTitle('TNPSC Group 4 — General Tamil · Full Set')).toBe('பொதுத் தமிழ் · Full Set');
  });
});

describe('names from the server', () => {
  it('win over the built-in glossary, and work from either language', async () => {
    const { registerServerNames } = await import('./bilingual');
    registerServerNames([
      { name: 'Physics', name_ta: 'இயற்பியல் (சேவையகம்)' },
      { name: 'Brand New Category', name_ta: 'புதிய பிரிவு' },
      { name: 'ஒரு துணைப் பிரிவு', name_en: 'A Sub-category' },
    ]);
    expect(bilingual('Physics')).toBe('Physics / இயற்பியல் (சேவையகம்)');
    expect(bilingual('Brand New Category')).toBe('Brand New Category / புதிய பிரிவு');
    expect(bilingual('ஒரு துணைப் பிரிவு')).toBe('A Sub-category / ஒரு துணைப் பிரிவு');
  });
});

describe('paper language', () => {
  it('shows General Tamil in Tamil only, General English in English only, the rest in both', async () => {
    const { paperLangOf, paperName, paperTitle } = await import('./bilingual');
    expect(paperLangOf('General Tamil')).toBe('ta');
    expect(paperLangOf('General English')).toBe('en');
    expect(paperLangOf('General Studies')).toBeNull();
    expect(paperName('Orthography', 'ta')).toBe('எழுத்திலக்கணம்');
    expect(paperName('Orthography / எழுத்திலக்கணம்', 'en')).toBe('Orthography');
    expect(paperName('பிழை திருத்தம்', 'ta')).toBe('பிழை திருத்தம்');
    expect(paperName('Chemistry', null)).toBe('Chemistry / வேதியியல்');
    expect(paperTitle('Grammar: Orthography · Mixed', 'ta')).toBe('இலக்கணம்: எழுத்திலக்கணம் · Mixed');
  });
});
