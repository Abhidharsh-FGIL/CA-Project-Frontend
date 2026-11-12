import { describe, expect, it, vi } from 'vitest';
import { bilingual, bilingualTitle, nodeName, ntpcNodeName, otherName, setReportNtpcLanguage, studentTitle } from './bilingual';

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

  it('reads a name both language papers carry by its script, not as the Tamil paper', async () => {
    const { paperLangOf, paperTitle, unitIdLang } = await import('./bilingual');
    // The General English units (g2-en-grammar …) arrive in English with no Tamil name.
    expect(bilingual('Grammar')).toBe('Grammar');
    expect(bilingual('Vocabulary')).toBe('Vocabulary');
    expect(bilingual('Writing Skills')).toBe('Writing Skills');
    expect(bilingualTitle('Grammar · Mixed')).toBe('Grammar · Mixed');
    expect(studentTitle('Grammar · Mixed')).toBe('Grammar · Mixed');
    // The General Tamil ones arrive in Tamil and stay Tamil.
    expect(bilingual('இலக்கணம்')).toBe('இலக்கணம்');
    expect(bilingual('சொல்லகராதி')).toBe('சொல்லகராதி');
    // With the unit id, each paper reads in its own language whatever the title says.
    expect(paperTitle('Grammar · Mixed', unitIdLang('g2-en-grammar'))).toBe('Grammar · Mixed');
    expect(paperTitle('Grammar · Mixed', unitIdLang('g2-ta-grammar'))).toBe('இலக்கணம் · Mixed');
    // A section holding both papers is neither language.
    expect(paperLangOf('General Tamil / General English')).toBeNull();
  });
});

describe('RRB NTPC titles follow the paper language', () => {
  it('drops the Tamil pair from an English paper and puts Hindi beside a Hindi one', () => {
    expect(bilingualTitle('RRB NTPC CBT-1 (Under-Graduate · English) — Current Events / நடப்பு நிகழ்வுகள் · Simple')).toBe('RRB NTPC CBT-1 (Under-Graduate · English) — Current Events · Simple');
    const hi = bilingualTitle('RRB NTPC CBT-1 (Graduate · Hindi) — Current Events / நடப்பு நிகழ்வுகள் · Simple');
    expect(hi).not.toMatch(/[஀-௿]/);
    expect(hi.startsWith('RRB NTPC CBT-1 (Graduate · Hindi) — ')).toBe(true);
    expect(hi.endsWith(' · Simple')).toBe(true);
  });
  it('leaves a Tamil paper bilingual as before', () => {
    expect(bilingualTitle('RRB NTPC CBT-1 (Graduate · Tamil) — Current Events / நடப்பு நிகழ்வுகள் · Simple')).toContain('நடப்பு நிகழ்வுகள்');
  });
});

describe('RRB NTPC titles follow the paper language first', () => {
  const stub = (language: string) => {
    const store: Record<string, string> = { 'mge.ntpc-prefs.u1': JSON.stringify({ level: 'graduate', language }) };
    vi.stubGlobal(
      'localStorage',
      new Proxy(store, { get: (t, k) => (k === 'getItem' ? (x: string) => t[x] ?? null : k === 'setItem' ? (x: string, v: string) => void (t[x] = v) : (t as any)[k]) }),
    );
  };
  it('a Tamil paper reads in Tamil whatever the aspirant chose', () => {
    stub('hindi');
    try {
      const t = bilingualTitle('RRB NTPC CBT-1 (Under-Graduate · Tamil) — Current Events / நடப்பு நிகழ்வுகள் · Simple');
      expect(t).toMatch(/[஀-௿]/);
      expect(t).not.toMatch(/[ऀ-ॿ]/);
      expect(t).not.toContain('Current Events');
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('the aspirant choice stands in for a paper that names no language', () => {
    stub('hindi');
    try {
      const t = bilingualTitle('RRB NTPC CBT-1 — Percentage / சதவீதம் · Simple');
      expect(t).not.toMatch(/[஀-௿]/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('RRB NTPC report names', () => {
  it('are in the chosen language only, and plain otherwise', () => {
    setReportNtpcLanguage('RRB NTPC CBT-1 (Graduate · English) — Percentage · Simple');
    try {
      expect(nodeName({ name: 'Percentage', nameLocal: 'சதவீதம்' })).toBe('Percentage');
      expect(nodeName({ name: 'சதவீதம்' })).toBe('Percentage');
      setReportNtpcLanguage('RRB NTPC CBT-1 (Graduate · Hindi) — Percentage · Simple');
      expect(nodeName({ name: 'Percentage', nameLocal: 'சதவீதம்' })).not.toMatch(/[஀-௿]/);
      setReportNtpcLanguage('RRB NTPC CBT-1 (Graduate · Tamil) — Percentage · Simple');
      expect(nodeName({ name: 'Percentage' })).toBe('சதவீதம்');
      setReportNtpcLanguage('RRB NTPC CBT-1 (Graduate · Hindi) — Percentage', 'ta');
      expect(nodeName({ name: 'Percentage' })).toBe('சதவீதம்');
      setReportNtpcLanguage('TNPSC Group 4 — Aptitude');
      expect(nodeName({ name: 'Percentage' })).toContain(' / ');
    } finally {
      setReportNtpcLanguage(null);
    }
  });
});

describe('ntpcNodeName', () => {
  it('names a unit in Tamil from the sheet when nothing else is registered', () => {
    expect(ntpcNodeName('Current Events', null, 'tamil')).toMatch(/[஀-௿]/);
    expect(ntpcNodeName('Current Events', null, 'english')).toBe('Current Events');
  });
});
