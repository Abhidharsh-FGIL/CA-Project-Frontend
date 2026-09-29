import { describe, expect, it } from 'vitest';
import {
  TNPSC_GROUPS,
  orderBySection,
  resolveSubjectId,
  sectionForSubject,
  stageForSubjects,
  stageForTitle,
  type TnpscStage,
} from './tnpsc';

const stage = (id: string): TnpscStage => {
  const found = TNPSC_GROUPS.flatMap(g => g.stages).find(s => s.id === id);
  if (!found) throw new Error(`no stage ${id}`);
  return found;
};

const G4 = stage('group-4-written');
const GATB = stage('gat-b-exam');

/** A paper as the generator hands it over: one entry per question, subject tagged. */
const paper = (...subjects: string[]) => subjects.map((subject, i) => ({ subject, n: i + 1 }));
const subjectsOf = (qs: Array<{ subject: string }>) => qs.map(q => q.subject);

describe('orderBySection — Group 4', () => {
  /**
   * The published paper is Q1-100 General Tamil/English, Q101-200 General Studies
   * and Aptitude. A generated paper arrives interleaved, so the sort is what puts
   * the language questions in the first hundred.
   */
  it('prints the language section before General Studies and Aptitude', () => {
    const out = orderBySection(
      G4,
      paper('indian-polity', 'general-tamil', 'aptitude-and-mental-ability', 'geography', 'general-tamil'),
      q => q.subject,
    );
    expect(subjectsOf(out)).toEqual([
      'general-tamil',
      'general-tamil',
      'indian-polity',
      'aptitude-and-mental-ability',
      'geography',
    ]);
  });

  /**
   * Two blocks, not three. The commission publishes General Studies and Aptitude as
   * separate sections but numbers them as one run, and the real 2024/2025 papers
   * scatter aptitude through the second hundred — so the sort must not pull it out
   * into a tail of its own.
   */
  it('keeps General Studies and Aptitude in the order they came in', () => {
    const second = paper('geography', 'aptitude-and-mental-ability', 'indian-polity', 'aptitude-and-mental-ability');
    const out = orderBySection(G4, second, q => q.subject);
    expect(subjectsOf(out)).toEqual(subjectsOf(second));
  });

  it('is stable inside a block', () => {
    const out = orderBySection(
      G4,
      paper('geography', 'general-tamil', 'indian-polity', 'general-tamil'),
      q => q.subject,
    );
    expect(out.map(q => q.n)).toEqual([2, 4, 1, 3]);
  });

  /** General English is sat instead of General Tamil, and belongs to the same block. */
  it('places General English in the first block too', () => {
    const out = orderBySection(G4, paper('indian-economy', 'general-english'), q => q.subject);
    expect(subjectsOf(out)).toEqual(['general-english', 'indian-economy']);
  });

  it('leaves a question whose subject it cannot place at the end rather than dropping it', () => {
    const out = orderBySection(G4, paper('who-knows', 'indian-polity', 'general-tamil'), q => q.subject);
    expect(subjectsOf(out)).toEqual(['general-tamil', 'indian-polity', 'who-knows']);
  });

  /**
   * Ordering reads the display-only `syllabus_subject_ids` map; marking must not.
   * Group 4 has no per-section marks or deduction, and a section resolved here would
   * hand every question both.
   */
  it('does not give Group 4 subjects a marking section', () => {
    expect(sectionForSubject(G4, 'general-tamil')).toBeUndefined();
    expect(sectionForSubject(G4, 'indian-polity')).toBeUndefined();
  });
});

describe('orderBySection — GAT-B', () => {
  /** Unchanged: GAT-B sorts on `subject_ids`, which it declares because its two
   * sections really are marked differently. */
  it('still prints Section A before Section B', () => {
    const out = orderBySection(GATB, paper('immunology', 'physics'), q => q.subject);
    expect(subjectsOf(out)).toEqual(['physics', 'immunology']);
  });
});

/**
 * A Group 4 booklet tags its Tamil questions in Tamil, using the commission's
 * wording for the unit rather than the catalog's name for the subject. That string
 * used to resolve to nothing at all: `subjectKey` stripped every non-ASCII
 * character, so the key came out empty and `resolveSubjectId` bailed. The effect on
 * screen was the whole point of the ordering — the 100 language questions landed in
 * no section, sorted to the end, and General Studies opened the paper.
 */
describe('subject resolution across scripts', () => {
  const TAMIL_UNIT = 'தமிழ் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு';
  const TN_HISTORY_UNIT = 'History, Culture, Heritage and Socio-Political Movements of Tamil Nadu';

  it('resolves a subject tagged in Tamil', () => {
    expect(resolveSubjectId(G4, TAMIL_UNIT)).toBe('general-tamil');
    expect(resolveSubjectId(G4, 'பொதுத் தமிழ்')).toBe('general-tamil');
    expect(resolveSubjectId(G4, 'இந்திய அரசியலமைப்பு')).toBe('indian-polity');
  });

  it('still tells two Tamil subjects apart', () => {
    expect(resolveSubjectId(G4, 'பொது அறிவியல்')).toBe('general-science');
    expect(resolveSubjectId(G4, 'இந்தியப் பொருளாதாரம்')).toBe('indian-economy');
  });

  it('resolves the syllabus wording of a General Studies unit', () => {
    expect(resolveSubjectId(G4, TN_HISTORY_UNIT)).toBe('tamil-nadu-history-and-society');
  });

  /**
   * End to end on a paper shaped like the real one. Group 1 shares ten of Group 4's
   * subjects, so a paper whose Tamil half resolved to nothing tied the two stages on
   * hits and picked Group 1 — which declares no blocks, leaving the sort a no-op.
   */
  it('orders a full 200-question paper into its two printed hundreds', () => {
    const GS = ['Indian Polity', 'General Science', 'Geography of India', 'Indian Economy', TN_HISTORY_UNIT];
    const tags = Array.from({ length: 200 }, (_, i) =>
      i % 2 === 0 ? TAMIL_UNIT : i % 7 === 3 ? 'Aptitude & Mental Ability' : GS[i % GS.length],
    );

    // The page resolves its stage from the paper: the title names no exam.
    const stage = stageForTitle('Exam-1 General Tamil & General Studies') ?? stageForSubjects(tags);
    expect(stage?.id).toBe('group-4-written');

    const out = orderBySection(stage, tags.map((subject, i) => ({ subject, n: i + 1 })), q => q.subject);
    expect(out.slice(0, 100).every(q => q.subject === TAMIL_UNIT)).toBe(true);
    expect(out.slice(100).some(q => q.subject === TAMIL_UNIT)).toBe(false);
  });
});
