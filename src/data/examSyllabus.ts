// ============================================================================
// Curated competitive-exam syllabus: subjects → chapters/topics per test type.
// Feeds the question-set generator's Subject & Chapter autocomplete suggestions
// (see EvalPaperConfigPanel → EvalSubjectCard).
//
// Keys MUST match the values in EXAMS (src/constants.ts): TNPSC Group 1/4,
// GAT-B, UPSC, SSC, IBPS, SBI, RRB, State PSC. Add a new exam by adding a key
// here — the generator picks it up automatically once that Test Type is selected.
// ============================================================================

import { TNPSC_GROUPS } from '@/config/tnpsc';

export interface SyllabusSubject {
  subject: string;
  chapters: string[];
  /**
   * Recommended question count for this section in the real exam
   * (e.g. IBPS Clerk Prelims: English 30, Numerical 35, Reasoning 35 = 100).
   * Used to auto-match the official section split when generating.
   */
  questions?: number;
}

// ── Catalog-driven exams (TNPSC, GAT-B) ─────────────────────────────────────
// Built from the single syllabus source of truth (src/config/tnpsc.ts) so the
// generator's subject/chapter suggestions always match the taxonomy the papers
// are tagged with. Only the per-section question counts live here.

/** Questions per subject in the real paper. Each map sums to that stage's pattern. */
const STAGE_SECTION_QUESTIONS: Record<string, Record<string, number>> = {
  // Group 1 Prelims: General Studies 175 + Aptitude 25
  'group-1-prelims': {
    'general-science': 25,
    'current-events': 20,
    geography: 20,
    'history-and-culture': 20,
    'indian-polity': 25,
    'indian-economy': 20,
    'indian-national-movement': 15,
    'tamil-nadu-history-and-society': 20,
    'development-administration-tn': 10,
    'aptitude-and-mental-ability': 25,
  },
  // Group 4 Written: Language 100 + General Studies 75 + Aptitude 25.
  // The candidate sits General Tamil *or* General English, so only one of the two
  // language sections goes into any single paper — both carry the same 100.
  'group-4-written': {
    'general-tamil': 100,
    'general-english': 100,
    'general-science': 12,
    'current-events': 10,
    geography: 10,
    'history-and-culture': 8,
    'indian-polity': 10,
    'indian-economy': 8,
    'indian-national-movement': 5,
    'tamil-nadu-history-and-society': 7,
    'development-administration-tn': 5,
    'aptitude-and-mental-ability': 25,
  },
  // GAT-B: Section A 60 (10+2 level, all compulsory) + Section B 100 printed,
  // of which the candidate answers any 60. The counts below are the *printed*
  // paper, so they sum to 160 — matching `total_questions`, not the 120 answered.
  // Genetics + Molecular Biology/rDNA carry the heaviest weight in Section B.
  'gat-b-exam': {
    'physics-12': 15,
    'chemistry-12': 15,
    'mathematics-12': 15,
    'biology-12': 15,
    biochemistry: 12,
    'cell-biology': 8,
    genetics: 15,
    'molecular-biology-and-rdna': 18,
    microbiology: 10,
    immunology: 8,
    'plant-biotechnology': 6,
    'animal-biotechnology': 6,
    'bioprocess-engineering': 7,
    'bioinformatics-and-biostatistics': 5,
    'ecology-and-evolution': 3,
    'analytical-techniques': 2,
  },
};

function stageSyllabus(stageId: string): SyllabusSubject[] {
  const stage = TNPSC_GROUPS.flatMap(g => g.stages).find(s => s.id === stageId);
  const counts = STAGE_SECTION_QUESTIONS[stageId] ?? {};
  return (stage?.subjects ?? []).map(s => ({
    subject: s.name,
    questions: counts[s.id],
    chapters: s.topics.map(t => t.name),
  }));
}

export const EXAM_SYLLABUS: Record<string, SyllabusSubject[]> = {
  // Keys are the `test_type` values sent to the generator — keep them in sync
  // with BOARDS in src/constants.ts.
  'TNPSC Group 1': stageSyllabus('group-1-prelims'),
  'TNPSC Group 4': stageSyllabus('group-4-written'),
  'GAT-B': stageSyllabus('gat-b-exam'),

  // IBPS Clerk Prelims — English Language (30) + Numerical Ability (35) +
  // Reasoning Ability (35) = 100 questions, 1 hour (20 min sectional).
  // NOTE: IBPS Clerk names the maths section "Numerical Ability"; IBPS PO calls
  // the same section "Quantitative Aptitude". We follow the Clerk convention.
  IBPS: [
    {
      subject: 'English Language',
      questions: 30,
      chapters: [
        'Reading Comprehension',
        'Cloze Test',
        'Para Jumbles',
        'Sentence Rearrangement',
        'Error Spotting',
        'Sentence Improvement',
        'Fillers (Single & Double Blanks)',
        'Word Swap',
        'Word Usage',
        'Column Based / Sentence Connectors',
        'Idioms & Phrases',
        'Synonyms & Antonyms',
        'Misspelt Words',
        'Vocabulary',
      ],
    },
    {
      subject: 'Numerical Ability',
      questions: 35,
      chapters: [
        'Number Series (Wrong / Missing)',
        'Simplification & Approximation',
        'Quadratic Equations',
        'Data Interpretation',
        'Data Sufficiency',
        'Number System',
        'Percentage',
        'Profit & Loss',
        'Simple & Compound Interest',
        'Average & Ages',
        'Ratio, Proportion & Partnership',
        'Time & Work',
        'Time, Speed & Distance',
        'Boats & Streams',
        'Pipes & Cisterns',
        'Mixtures & Alligations',
        'Mensuration',
        'Permutation, Combination & Probability',
      ],
    },
    {
      subject: 'Reasoning Ability',
      questions: 35,
      chapters: [
        'Puzzles',
        'Seating Arrangement',
        'Syllogism',
        'Inequality',
        'Coding-Decoding',
        'Blood Relations',
        'Direction Sense',
        'Ranking & Ordering',
        'Alphanumeric / Alphabet Series',
        'Input-Output',
        'Data Sufficiency',
        'Clock & Calendar',
        'Critical Reasoning',
      ],
    },
  ],
};

/** Subject names seeded for a given test type (empty if none / no type chosen). */
export function getSyllabusSubjects(testType?: string): string[] {
  if (!testType) return [];
  return (EXAM_SYLLABUS[testType] || []).map(s => s.subject);
}

/** Chapters/topics seeded for a (test type, subject) pair. Case-insensitive match. */
export function getSyllabusChapters(testType?: string, subject?: string): string[] {
  if (!testType || !subject) return [];
  const subjects = EXAM_SYLLABUS[testType] || [];
  const match = subjects.find(s => s.subject.toLowerCase() === subject.toLowerCase());
  return match ? match.chapters : [];
}

/** Full section definitions (with recommended question counts) for a test type. */
export function getSyllabusSections(testType?: string): SyllabusSubject[] {
  if (!testType) return [];
  return EXAM_SYLLABUS[testType] || [];
}
