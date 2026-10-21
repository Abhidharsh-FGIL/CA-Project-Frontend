import { describe, expect, it } from 'vitest';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import {
  EXAM_LANGUAGE_OPTIONS,
  catalogForLanguage,
  examLanguageLabel,
  examLanguageOf,
  examLanguageValue,
  hasLanguageChoice,
  paperIsFor,
  paperLanguage,
  papersFor,
  sectionLanguage,
  stageForLanguage,
  subjectLanguage,
  textLanguage,
} from '@/lib/exam-language';
import { paperStructure } from '@/lib/paper-structure';

const group4 = TNPSC_GROUPS.find(g => g.id === 'group-4')!;
const written = group4.stages[0];
const names = (s: typeof written) => (s.pattern?.sections ?? []).map(x => x.name);

describe('examLanguageOf — what the stored medium means', () => {
  it('reads the two stored values, whatever their case', () => {
    expect(examLanguageOf('Tamil')).toBe('tamil');
    expect(examLanguageOf('English')).toBe('english');
    expect(examLanguageOf(' tamil ')).toBe('tamil');
    expect(examLanguageOf('ENGLISH')).toBe('english');
  });

  it('reads the label as well', () => {
    expect(examLanguageOf('General Tamil')).toBe('tamil');
    expect(examLanguageOf('general english')).toBe('english');
  });

  it('is nothing for an account that never answered, or answered with another language', () => {
    for (const m of [undefined, null, '', 'Hindi', 'Telugu', 'Other', 'Tamil Nadu']) expect(examLanguageOf(m)).toBeNull();
  });

  it('round-trips through what the form stores', () => {
    for (const o of EXAM_LANGUAGE_OPTIONS) {
      expect(examLanguageOf(o.value)).toBe(o.language);
      expect(examLanguageValue(o.language)).toBe(o.value);
      expect(examLanguageLabel(o.language)).toBe(o.label);
    }
  });
});

describe('textLanguage — what a title says', () => {
  it('reads a language in brackets, or the language paper by name', () => {
    expect(textLanguage('TNPSC Group 4 — Full Mock (Tamil)')).toBe('tamil');
    expect(textLanguage('TNPSC Group 4 — Full Mock (English)')).toBe('english');
    expect(textLanguage('General Tamil: Grammar — Simple')).toBe('tamil');
    expect(textLanguage('general english full set')).toBe('english');
  });

  it('does not take Tamil Nadu, or a bare language word, for the language paper', () => {
    expect(textLanguage('Tamil Nadu History — Simple')).toBeNull();
    expect(textLanguage('Development Administration in Tamil Nadu')).toBeNull();
    expect(textLanguage('English Grammar practice')).toBeNull();
    expect(textLanguage('General Studies — Mixed')).toBeNull();
    expect(textLanguage(null)).toBeNull();
  });

  it('says nothing for a title that names both', () => {
    expect(textLanguage('General Tamil / General English — overview')).toBeNull();
  });
});

describe('paperLanguage — which language paper a paper belongs to', () => {
  it("trusts the server's own word first", () => {
    expect(paperLanguage({ language: 'tamil', title: 'Full Mock (English)' })).toBe('tamil');
    expect(paperLanguage({ tnpsc_language: 'EN' })).toBe('english');
    expect(paperLanguage({ language: 'ta' })).toBe('tamil');
  });

  it('then the section it is the full set of, then its subject, then its title', () => {
    expect(paperLanguage({ section_name: 'General English', title: 'Set 1' })).toBe('english');
    expect(paperLanguage({ subject_id: 'general-tamil', title: 'Grammar — Medium' })).toBe('tamil');
    expect(paperLanguage({ title: 'Full Mock (Tamil)' })).toBe('tamil');
  });

  it('is nothing for a paper that is for everyone', () => {
    expect(paperLanguage({ title: 'Aptitude & Mental Ability — Simple', subject_id: 'aptitude-and-mental-ability' })).toBeNull();
    expect(paperLanguage({ title: 'Tamil Nadu History — Mixed', subject_id: 'tamil-nadu-history-and-society' })).toBeNull();
    expect(paperLanguage({})).toBeNull();
  });
});

describe('papersFor — keeping a language\'s papers', () => {
  const papers = [
    { title: 'Full Mock (English)' },
    { title: 'Full Mock (Tamil)' },
    { title: 'General Studies — Simple' },
    { title: 'x', subject_id: 'general-tamil' },
  ];

  it('drops the other language\'s papers and keeps everything else', () => {
    expect(papersFor('tamil', papers).map(p => p.title)).toEqual(['Full Mock (Tamil)', 'General Studies — Simple', 'x']);
    expect(papersFor('english', papers).map(p => p.title)).toEqual(['Full Mock (English)', 'General Studies — Simple']);
  });

  it('keeps all of them until a language is chosen', () => {
    expect(papersFor(null, papers)).toBe(papers);
    expect(paperIsFor(null, { title: 'Full Mock (English)' })).toBe(true);
  });
});

describe('the Group 4 stage for a language', () => {
  it('lists both language papers before a choice, as the catalog has them', () => {
    expect(names(written)).toEqual(['General Tamil', 'General English', 'General Studies', 'Aptitude & Mental Ability']);
    expect(hasLanguageChoice(written)).toBe(true);
    expect(sectionLanguage({ name: 'General Tamil', alternative_to: 'General English' })).toBe('tamil');
    expect(sectionLanguage({ name: 'General English', alternative_to: 'General Tamil' })).toBe('english');
    expect(sectionLanguage({ name: 'General Studies' })).toBeNull();
  });

  it('keeps General Tamil and drops General English for a Tamil aspirant', () => {
    const s = stageForLanguage(written, 'tamil');
    expect(names(s)).toEqual(['General Tamil', 'General Studies', 'Aptitude & Mental Ability']);
    expect(s.subjects.some(x => x.id === 'general-english')).toBe(false);
    expect(s.subjects.some(x => x.id === 'general-tamil')).toBe(true);
  });

  it('keeps General English and drops General Tamil for an English aspirant', () => {
    const s = stageForLanguage(written, 'english');
    expect(names(s)).toEqual(['General English', 'General Studies', 'Aptitude & Mental Ability']);
    expect(s.subjects.some(x => x.id === 'general-tamil')).toBe(false);
  });

  it('is no longer "instead of" anything once one is gone', () => {
    const s = stageForLanguage(written, 'tamil');
    expect(s.pattern!.sections[0].alternative_to).toBeUndefined();
    expect(paperStructure(s.pattern).map(r => r.label)).toEqual(['General Tamil', 'General Studies', 'Aptitude & Mental Ability']);
    expect(hasLanguageChoice(s)).toBe(false);
  });

  it('keeps the units of the section that stays', () => {
    const s = stageForLanguage(written, 'english');
    expect(s.pattern!.sections[0].units!.length).toBeGreaterThan(0);
    expect(s.pattern!.sections[0].units).toBe(written.pattern!.sections[1].units);
  });

  it('keeps the paper totals — the language counts once either way', () => {
    expect(stageForLanguage(written, 'tamil').pattern!.total_questions).toBe(written.pattern!.total_questions);
  });

  it('does not touch the original, and hands back the same stage when there is nothing to remove', () => {
    stageForLanguage(written, 'tamil');
    expect(names(written)).toHaveLength(4);
    expect(stageForLanguage(written, null)).toBe(written);
    const noChoice = stageForLanguage(written, 'tamil');
    expect(stageForLanguage(noChoice, 'tamil')).toBe(noChoice);
  });

  it('leaves a stage with no language choice alone', () => {
    const group1 = TNPSC_GROUPS.find(g => g.id === 'group-1')!;
    const prelims = group1.stages[0];
    expect(stageForLanguage(prelims, 'tamil')).toBe(prelims);
  });
});

describe('catalogForLanguage', () => {
  it('applies to every group, and returns untouched groups as they were', () => {
    const tamil = catalogForLanguage(TNPSC_GROUPS, 'tamil');
    expect(tamil).toHaveLength(TNPSC_GROUPS.length);
    expect(names(tamil.find(g => g.id === 'group-4')!.stages[0])).toEqual(['General Tamil', 'General Studies', 'Aptitude & Mental Ability']);
    const untouched = TNPSC_GROUPS.find(g => g.id === 'gat-b')!;
    expect(tamil.find(g => g.id === 'gat-b')).toBe(untouched);
  });

  it('is the catalog itself until a language is chosen', () => {
    expect(catalogForLanguage(TNPSC_GROUPS, null)).toBe(TNPSC_GROUPS);
  });
});

describe('subjectLanguage', () => {
  it('knows the two language papers and nothing else', () => {
    expect(subjectLanguage('general-tamil')).toBe('tamil');
    expect(subjectLanguage('general-english')).toBe('english');
    expect(subjectLanguage('tamil-nadu-history-and-society')).toBeNull();
    expect(subjectLanguage(null)).toBeNull();
  });
});
