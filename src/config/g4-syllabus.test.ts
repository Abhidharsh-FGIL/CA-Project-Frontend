/**
 * The Group 4 syllabus, checked against the commission's published paper —
 * "Combined Civil Services Examination – IV (Group IV Services)", Code 496,
 * dated 12.12.2024. Every figure below is printed in that PDF; if the catalog
 * drifts from it, these fail.
 */
import { describe, it, expect } from 'vitest';
import { TNPSC_GROUPS, findUnit, isTamilOnlySection, resolveSubjectId, unitDisplayName } from './tnpsc';

const stage = TNPSC_GROUPS.find(g => g.id === 'group-4')!
  .stages.find(s => s.id === 'group-4-written')!;
const sections = stage.pattern!.sections;
const section = (n: string) => sections.find(s => s.name === n)!;

describe('TNPSC Group 4 — published syllabus', () => {
  it('is one paper of 200 questions / 300 marks / 3 hours', () => {
    expect(stage.pattern!.total_questions).toBe(200);
    expect(stage.pattern!.total_marks).toBe(300);
    expect(stage.pattern!.duration_minutes).toBe(180);
  });

  it('Part A — General Studies: 6 printed units summing to 75, plus a practice-only Current Affairs unit', () => {
    const u = section('General Studies').units!;
    expect(u.map(x => x.questions)).toEqual([5, 5, 10, 15, 20, 20, 0]);
    expect(u.reduce((n, x) => n + x.questions, 0)).toBe(75);
    expect(section('General Studies').questions).toBe(75);
  });

  it('Part B — Aptitude & Mental Ability: Aptitude 15 + Reasoning 10', () => {
    const u = section('Aptitude & Mental Ability').units!;
    expect(u.map(x => x.name)).toEqual(['Aptitude', 'Reasoning']);
    expect(u.map(x => x.questions)).toEqual([15, 10]);
    // The PDF lists ten aptitude items and six reasoning items.
    expect(u[0].topics).toHaveLength(10);
    expect(u[1].topics).toHaveLength(6);
  });

  it('Part C — Tamil: 7 units, split 25/15/15/10/15/5/15', () => {
    const u = section('General Tamil').units!;
    expect(u.map(x => x.questions)).toEqual([25, 15, 15, 10, 15, 5, 15]);
    expect(u.reduce((n, x) => n + x.questions, 0)).toBe(100);
  });

  it('Part C — English: 7 units, split 25/15/10/10/20/5/15', () => {
    const u = section('General English').units!;
    expect(u.map(x => x.questions)).toEqual([25, 15, 10, 10, 20, 5, 15]);
    expect(u.reduce((n, x) => n + x.questions, 0)).toBe(100);
  });

  it('every unit of every section carries its topics', () => {
    for (const sec of sections) {
      for (const unit of sec.units ?? []) {
        expect(
          (unit.topics?.length ?? 0) > 0 || (unit.subject_ids?.length ?? 0) > 0,
          `${sec.name} → ${unit.name} has neither topics nor subject_ids`,
        ).toBe(true);
      }
    }
  });

  it('the two language papers are alternatives, not additions', () => {
    expect(section('General Tamil').alternative_to).toBe('General English');
    expect(section('General English').alternative_to).toBe('General Tamil');
    // GS 75 + Aptitude 25 + one language 100 = 200, not 300.
    const nonLanguage = sections
      .filter(s => !s.alternative_to)
      .reduce((n, s) => n + s.questions, 0);
    expect(nonLanguage + 100).toBe(stage.pattern!.total_questions);
  });

  it('every unit carries its own printed topics, not a subject taxonomy', () => {
    for (const sec of sections) {
      for (const unit of sec.units ?? []) {
        expect(
          unit.topics?.length ?? 0,
          `${sec.name} → ${unit.name} has no topics of its own`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('General Studies units read from the published syllabus', () => {
    const u = section('General Studies').units!;
    const name = (i: number) => u[i].topics!.map(t => t.name);
    // Unit I's first topics are the PDF's opening clause, not "Physics, Chemistry".
    expect(name(0)[0]).toBe('Nature of Universe');
    expect(name(0)).toContain('Environmental science');
    expect(name(1)[0]).toBe('Earth location');
    expect(name(2)[0]).toBe('Indus Valley Civilization');
    expect(name(3)[0]).toBe('Constitution of India — Preamble');
    expect(name(4)[0]).toBe('Nature of Indian economy');
    expect(name(5)).toContain('Philosophical content in Thirukkural');
  });

  it('keeps subject_ids alongside, so papers still match', () => {
    const u = section('General Studies').units!;
    expect(u[0].subject_ids).toEqual(['general-science']);
    expect(u[2].subject_ids).toEqual(['history-and-culture', 'indian-national-movement']);
    expect(u[4].subject_ids).toEqual(['indian-economy', 'development-administration-tn']);
  });
});

/*
 * The names themselves. The counts above would still pass if a unit were renamed,
 * and a sheet that copies the printed names is only as good as the catalog's match
 * to them — so each is pinned to the syllabus's own wording, numeral included.
 */
describe('TNPSC Group 4 — unit names as printed', () => {
  const names = (sec: string) => section(sec).units!.map(u => [u.label, u.name]);

  it('Part A names its six printed units, then Current Affairs', () => {
    expect(names('General Studies')).toEqual([
      ['I', 'General Science'],
      ['II', 'Geography'],
      ['III', 'History, Culture of India, and Indian National Movement'],
      ['IV', 'Indian Polity'],
      ['V', 'Indian Economy and Development Administration in Tamil Nadu'],
      ['VI', 'History, Culture, Heritage, and Socio-Political Movements of Tamil Nadu'],
      ['VII', 'Current Affairs'],
    ]);
  });

  it('Part B names its two units', () => {
    expect(names('Aptitude & Mental Ability')).toEqual([
      ['I', 'Aptitude'],
      ['II', 'Reasoning'],
    ]);
  });

  it('Part C (English) names its seven units', () => {
    expect(names('General English')).toEqual([
      ['I', 'Grammar'],
      ['II', 'Vocabulary'],
      ['III', 'Writing Skills'],
      ['IV', 'Technical Terms'],
      ['V', 'Reading Comprehension'],
      ['VI', 'Translation'],
      ['VII', 'Literary Works'],
    ]);
  });

  it('Part C (Tamil) prints its unit names in Tamil only', () => {
    expect(section('General Tamil').units!.map(u => [u.label, u.name_ta])).toEqual([
      ['I', 'இலக்கணம்'],
      ['II', 'சொல்லகராதி'],
      ['III', 'எழுதும் திறன்'],
      ['IV', 'கலைச் சொற்கள்'],
      ['V', 'வாசித்தல் – புரிந்து கொள்ளும் திறன்'],
      ['VI', 'எளிய மொழி பெயர்ப்பு'],
      ['VII', 'இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும்'],
    ]);
  });
});

describe('TNPSC Group 4 — a sheet that copies the printed names', () => {
  const resolve = (label: string) => resolveSubjectId(stage, label);

  it.each([
    ['General Science', 'general-science'],
    ['Geography', 'geography'],
    ['Indian Polity', 'indian-polity'],
    ['History, Culture, Heritage, and Socio-Political Movements of Tamil Nadu', 'tamil-nadu-history-and-society'],
    ['Aptitude and Mental Ability', 'aptitude-and-mental-ability'],
  ])('finds the subject for "%s"', (label, id) => {
    expect(resolve(label)).toBe(id);
  });

  // These two were the gap: each names a unit that is more than one subject, so
  // the catalog had no subject by that name and the question fell out of its section.
  it('lets a unit that spans two subjects stand for its first', () => {
    expect(resolve('History, Culture of India, and Indian National Movement')).toBe('history-and-culture');
    expect(resolve('Indian Economy and Development Administration in Tamil Nadu')).toBe('indian-economy');
  });

  it('keeps those questions inside the unit’s own pool', () => {
    const unit = (id: string) => section('General Studies').units!.find(u => u.id === id)!;
    expect(unit('g4-gs-history-and-inm').subject_ids).toContain(resolve('History, Culture of India, and Indian National Movement'));
    expect(unit('g4-gs-economy-and-dev-admin').subject_ids).toContain(resolve('Indian Economy and Development Administration in Tamil Nadu'));
  });

  it('finds the subject for an aptitude unit', () => {
    expect(resolve('Aptitude')).toBe('aptitude-and-mental-ability');
    expect(resolve('Reasoning')).toBe('aptitude-and-mental-ability');
  });

  it('finds the Tamil paper by a unit’s printed Tamil name', () => {
    expect(resolve('இலக்கணம்')).toBe('general-tamil');
    expect(resolve('இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும்')).toBe('general-tamil');
  });

  it('does not guess a language from a unit name both papers share', () => {
    // "Grammar" is Unit I of Tamil and of English; the word alone cannot say which.
    for (const shared of ['Grammar', 'Vocabulary', 'Writing Skills', 'Technical Terms', 'Reading Comprehension', 'Translation', 'Literary Works']) {
      expect(resolve(shared), shared).toBeUndefined();
    }
  });

  it('leaves a heading that is a whole section unresolved', () => {
    // "General Studies" is six units and nine subjects, not one of them.
    expect(resolve('General Studies')).toBeUndefined();
  });
});

describe('TNPSC Group 4 — the name a unit is shown under', () => {
  const shown = (id: string) => unitDisplayName(stage, findUnit(stage, id));

  it('names every Tamil unit as the syllabus prints it, in Tamil', () => {
    expect(section('General Tamil').units!.map(u => unitDisplayName(stage, u))).toEqual([
      'இலக்கணம்',
      'சொல்லகராதி',
      'எழுதும் திறன்',
      'கலைச் சொற்கள்',
      'வாசித்தல் – புரிந்து கொள்ளும் திறன்',
      'எளிய மொழி பெயர்ப்பு',
      'இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும்',
    ]);
  });

  it('leaves the English paper in English', () => {
    expect(shown('g4-en-grammar')).toBe('Grammar');
    expect(shown('g4-en-translation')).toBe('Translation');
  });

  it('does not replace a General Studies name with its display translation', () => {
    // `name_ta` there is a translation supplied for display, not the commission's wording.
    expect(shown('g4-gs-indian-polity')).toBe('Indian Polity');
    expect(shown('g4-apt-reasoning')).toBe('Reasoning');
  });

  it('gives two papers that share a unit name different names', () => {
    expect(shown('g4-ta-grammar')).not.toBe(shown('g4-en-grammar'));
  });

  it('falls back to the name when there is nothing to show instead', () => {
    expect(unitDisplayName(undefined, findUnit(stage, 'g4-ta-grammar'))).toBe('Grammar');
    expect(unitDisplayName(stage, undefined)).toBe('');
  });

  it('reads a section as Tamil-only only when it names the Tamil paper alone', () => {
    expect(isTamilOnlySection(section('General Tamil'))).toBe(true);
    expect(isTamilOnlySection(section('General English'))).toBe(false);
    expect(isTamilOnlySection({ subject_ids: ['general-tamil', 'general-english'] })).toBe(false);
  });
});
