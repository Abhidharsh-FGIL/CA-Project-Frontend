/**
 * Exam catalog — the shape of the aspirant portal.
 *
 *   TNPSC Group 1 ──┬── Prelims  (active)
 *                   └── Mains    (coming soon)
 *   TNPSC Group 4 ──┬── Written  (active)
 *   GAT-B         ──┬── Exam     (active)
 *
 * The types and file are still named `Tnpsc*` for continuity with the backend
 * contract (TNPSC_API_SPEC.md) — a "group" is really any examination the portal
 * prepares for, and GAT-B is one that happens not to be a TNPSC group at all.
 *
 * Each active stage exposes two test tracks:
 *   • Mock Test     — full-length, real exam pattern, gated by level
 *                     (Simple → Medium → Complex, unlocked in order)
 *   • Practice Test — syllabus based, one card per subject/topic, 30–50 questions
 *
 * This file is the *fallback* catalog. When the backend serves
 * GET /api/v1/user/tnpsc/catalog the server payload wins; until then the portal
 * renders from these constants so the hierarchy is always navigable.
 */

// ─── Ids & levels ──────────────────────────────────────────────────────────────

export type TnpscGroupId = 'group-1' | 'group-4' | 'gat-b';
export type TnpscStageId =
  | 'group-1-prelims'
  | 'group-1-mains'
  | 'group-4-written'
  | 'group-4-interview'
  | 'gat-b-exam';
export type TnpscLevel = 'simple' | 'medium' | 'complex';
export type TnpscTestType = 'mock' | 'practice';

/** Level order — a level unlocks only when the previous one is cleared. */
export const TNPSC_LEVELS: TnpscLevel[] = ['simple', 'medium', 'complex'];

/**
 * Minimum score (%) in a level's mock test before the next level unlocks.
 *
 * The stricter of this and the server's `pass_percentage` wins (see
 * `effectivePassPercentage` in src/lib/tnpscApi.ts), so the portal never offers a
 * level the backend would refuse to start. Keep the backend's
 * `TNPSC_LEVEL_PASS_PERCENTAGE` setting on the same number.
 */
export const LEVEL_PASS_PERCENTAGE = 20;

/**
 * Sequential level progression (Simple → Medium → Complex).
 *
 * OFF: every level is open from the start — aspirants pick any difficulty in any
 * order. Levels still track "cleared" against LEVEL_PASS_PERCENTAGE as a progress
 * marker; it just doesn't gate anything.
 *
 * Flip to `true` to restore the gate. The backend must agree: with the gate off
 * server-side too, `POST .../start` must stop returning 403 LEVEL_LOCKED,
 * otherwise the portal offers a paper the API then refuses.
 */
export const LEVEL_GATE_ENABLED = false;

/**
 * Whether a level the server reports as locked is shown locked.
 *
 * OFF: every level is offered, whatever the payload says — Simple, Medium and
 * Complex are all open from the start.
 *
 * This only controls what the portal *shows*. The server runs its own gate: a
 * level it has closed arrives with `tests: []`, and `POST .../start` answers 403
 * LEVEL_LOCKED however this is set. So the backend's own
 * `TNPSC_LEVEL_GATE_ENABLED` must be off too, or an aspirant is offered a paper
 * the API then refuses. Where the server has closed a level, the empty state says
 * so rather than claiming nothing is published.
 */
export const LEVEL_RESPECT_SERVER_LOCK = false;

/** How many mock tests of a level must be cleared to unlock the next: 'any' | 'all'. */
export const LEVEL_UNLOCK_RULE: 'any' | 'all' = 'any';

/** Question-count band for a syllabus practice test. */
export const PRACTICE_MIN_QUESTIONS = 30;
export const PRACTICE_MAX_QUESTIONS = 50;

export const LEVEL_META: Record<
  TnpscLevel,
  { label: string; order: number; blurb: string; accent: string; chip: string; ring: string }
> = {
  simple: {
    label: 'Simple',
    order: 1,
    blurb: 'Foundation level — direct, factual questions straight from the syllabus.',
    accent: 'from-emerald-500 to-teal-500',
    chip: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    ring: 'border-emerald-200 dark:border-emerald-900',
  },
  medium: {
    label: 'Medium',
    order: 2,
    blurb: 'Exam level — application, matching and statement-based questions.',
    accent: 'from-amber-500 to-orange-500',
    chip: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    ring: 'border-amber-200 dark:border-amber-900',
  },
  complex: {
    label: 'Complex',
    order: 3,
    blurb: 'Topper level — analytical, multi-concept and elimination-heavy questions.',
    accent: 'from-rose-500 to-red-500',
    chip: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    ring: 'border-rose-200 dark:border-rose-900',
  },
};

/** Difficulty values used by the existing test/assessment APIs → TNPSC level. */
export const DIFFICULTY_TO_LEVEL: Record<string, TnpscLevel> = {
  easy: 'simple',
  simple: 'simple',
  medium: 'medium',
  moderate: 'medium',
  hard: 'complex',
  complex: 'complex',
  difficult: 'complex',
};

export function levelIndex(level: TnpscLevel): number {
  return TNPSC_LEVELS.indexOf(level);
}

export function previousLevel(level: TnpscLevel): TnpscLevel | null {
  const i = levelIndex(level);
  return i > 0 ? TNPSC_LEVELS[i - 1] : null;
}

// ─── Catalog types ─────────────────────────────────────────────────────────────

export interface TnpscTopic {
  /** Stable slug — sent to the backend as `topic` when listing practice tests. */
  id: string;
  name: string;
}

/**
 * One numbered unit of a published syllabus, with the questions it carries.
 *
 * Units are the level the commission actually publishes counts at, and they do not
 * line up with the catalog's subjects: Group 4's Unit III is one 10-question unit
 * covering what the catalog splits into two subjects, and "Current affairs" is
 * examined inside four units rather than standing as one. Splitting a published
 * count across catalog subjects would be inventing a distribution the syllabus does
 * not state, so the panel shows the units as printed.
 */
export interface TnpscSyllabusUnit {
  id: string;
  /** Numeral as printed, e.g. "I" — rendered as the unit's eyebrow. */
  label?: string;
  name: string;
  name_ta?: string;
  /** Questions this unit carries, straight from the published syllabus. */
  questions: number;
  /** Sub-topics as printed under the unit. */
  topics?: TnpscTopic[];
  /** Catalog subjects this unit covers, when its topics come from the catalog instead. */
  subject_ids?: string[];
}

export interface TnpscSubject {
  /** Stable slug — sent to the backend as `subject`. */
  id: string;
  name: string;
  /** Tamil label, shown as a secondary line where available. */
  name_ta?: string;
  /**
   * Other names a paper may tag this subject with.
   *
   * Question papers do not use the catalog's wording — a GAT-B paper tags its
   * cloning questions "Recombinant DNA / Genetic Engineering" where the catalog
   * says "Molecular Biology & rDNA Technology". Matching on the canonical name
   * alone leaves such a question in no section at all, which costs it its section
   * marks and its deduction, and hides the section filter entirely.
   */
  aliases?: string[];
  topics: TnpscTopic[];
}

export interface TnpscExamPattern {
  /** Questions printed in the paper — not necessarily the number answered. */
  total_questions: number;
  /**
   * Questions the candidate actually answers, when the paper offers a choice.
   * Omitted when every printed question is mandatory (both TNPSC stages).
   * GAT-B prints 160 and asks for 120.
   */
  total_attempted?: number;
  total_marks: number;
  duration_minutes: number;
  negative_marking: boolean;
  /** Paper-wide deduction. Sections may override it — see `negative_mark_value` below. */
  negative_mark_value?: number;
  sections: Array<{
    name: string;
    /** Questions printed in this section. */
    questions: number;
    /** Marks the section contributes to `total_marks`. */
    marks?: number;
    /** Answer any `attempt` of `questions`. Omitted when the whole section is mandatory. */
    attempt?: number;
    /** Marks per correct answer, when sections are not all weighted the same. */
    marks_per_question?: number;
    /** Deduction per wrong answer in this section, overriding the paper-wide value. */
    negative_mark_value?: number;
    /**
     * Subject slugs that belong to this section. Present when sections are marked
     * differently, so a question's subject decides what it is worth and what a wrong
     * answer costs — see `sectionForSubject`. Omitted when the whole paper is
     * uniform, as both TNPSC stages are.
     */
    subject_ids?: string[];
    /**
     * Which subjects this section covers, for the syllabus panel only.
     *
     * Kept separate from `subject_ids` because that field drives marking and
     * question ordering — `orderBySection` treats any section carrying it as a
     * paper whose questions must be grouped by section, which is wrong for the
     * TNPSC stages. This one is read by the UI and by nothing else.
     */
    syllabus_subject_ids?: string[];
    /**
     * The published syllabus units under this section, with their question counts.
     * Present where the commission publishes a unit-wise split; sections without it
     * fall back to listing `syllabus_subject_ids` with no counts.
     */
    units?: TnpscSyllabusUnit[];
    /** Footnote under the section in the syllabus panel. */
    note?: string;
  }>;
}

export interface TnpscStage {
  id: TnpscStageId;
  group_id: TnpscGroupId;
  name: string;
  short_name: string;
  description: string;
  /** 'active' stages are navigable; 'coming_soon' render disabled. */
  status: 'active' | 'coming_soon';
  /** Objective (MCQ) stages support mock + practice; descriptive stages do not yet. */
  paper_type: 'objective' | 'descriptive';
  /**
   * Group 4 papers are printed in two languages — every question repeated in
   * `secondary_language` under the same number. Group 1 Prelims is single-language.
   */
  bilingual: boolean;
  /** The language questions are repeated in when `bilingual`. */
  secondary_language?: 'ta' | 'en' | null;
  pattern?: TnpscExamPattern;
  subjects: TnpscSubject[];
}

export interface TnpscGroup {
  id: TnpscGroupId;
  name: string;
  short_name: string;
  /**
   * The body that conducts the exam, shown as the eyebrow on the group card.
   * Not every group is a TNPSC one, so this cannot be hardcoded in the UI.
   */
  authority: string;
  /**
   * The generator's `test_type` for papers placed under this group. Must be a
   * value in BOARDS (src/constants.ts) and a key of EXAM_SYLLABUS
   * (src/data/examSyllabus.ts) — see `examTypeLabel` in src/lib/tnpscAdminApi.ts.
   */
  exam_type: string;
  tagline: string;
  description: string;
  /** Tailwind gradient used on the group card. */
  accent: string;
  posts: string[];
  stages: TnpscStage[];
}

// ─── TNPSC syllabus ─────────────────────────────────────────────────────────────

const GENERAL_STUDIES_SUBJECTS: TnpscSubject[] = [
  {
    id: 'general-science',
    name: 'General Science',
    name_ta: 'பொது அறிவியல்',
    topics: [
      { id: 'physics', name: 'Physics' },
      { id: 'chemistry', name: 'Chemistry' },
      { id: 'botany', name: 'Botany' },
      { id: 'zoology', name: 'Zoology' },
      { id: 'science-in-everyday-life', name: 'Science in Everyday Life' },
    ],
  },
  {
    id: 'current-events',
    name: 'Current Events',
    name_ta: 'நடப்பு நிகழ்வுகள்',
    topics: [
      { id: 'national-current-affairs', name: 'National Current Affairs' },
      { id: 'international-current-affairs', name: 'International Current Affairs' },
      { id: 'tamil-nadu-current-affairs', name: 'Tamil Nadu Current Affairs' },
      { id: 'sports-and-awards', name: 'Sports & Awards' },
      { id: 'schemes-and-policies', name: 'Government Schemes & Policies' },
    ],
  },
  {
    id: 'geography',
    name: 'Geography of India',
    name_ta: 'இந்திய புவியியல்',
        /**
     * The wording the published Tamil syllabus uses for this unit.
     *
     * A Group 4 booklet tags its questions in Tamil, and the phrasing is the
     * commission's, not the catalog's — without these the report cannot resolve
     * the subject and has no English label to show for it.
     */
    aliases: [
      'புவியியல்',
      'Geography',
    ],
    topics: [
      { id: 'physical-geography', name: 'Physical Geography' },
      { id: 'climate-and-monsoon', name: 'Climate & Monsoon' },
      { id: 'rivers-and-water-resources', name: 'Rivers & Water Resources' },
      { id: 'agriculture-and-minerals', name: 'Agriculture & Minerals' },
      { id: 'tamil-nadu-geography', name: 'Tamil Nadu Geography' },
    ],
  },
  {
    id: 'history-and-culture',
    name: 'History and Culture of India',
    name_ta: 'இந்திய வரலாறு மற்றும் பண்பாடு',
    topics: [
      { id: 'ancient-india', name: 'Ancient India' },
      { id: 'medieval-india', name: 'Medieval India' },
      { id: 'modern-india', name: 'Modern India' },
      { id: 'art-and-architecture', name: 'Art & Architecture' },
    ],
  },
  {
    id: 'indian-polity',
    name: 'Indian Polity',
    name_ta: 'இந்திய அரசியலமைப்பு',
        /**
     * The wording the published Tamil syllabus uses for this unit.
     *
     * A Group 4 booklet tags its questions in Tamil, and the phrasing is the
     * commission's, not the catalog's — without these the report cannot resolve
     * the subject and has no English label to show for it.
     */
    aliases: [
      'இந்திய அரசியல் அமைப்பு',
      'Indian Constitution',
    ],
    topics: [
      { id: 'constitution-basics', name: 'Constitution — Basics & Preamble' },
      { id: 'fundamental-rights-duties', name: 'Fundamental Rights & Duties' },
      { id: 'union-and-state-executive', name: 'Union & State Executive' },
      { id: 'parliament-and-judiciary', name: 'Parliament & Judiciary' },
      { id: 'local-self-government', name: 'Local Self Government' },
    ],
  },
  {
    id: 'indian-economy',
    name: 'Indian Economy',
    name_ta: 'இந்தியப் பொருளாதாரம்',
    topics: [
      { id: 'national-income', name: 'National Income' },
      { id: 'planning-and-niti-aayog', name: 'Planning & NITI Aayog' },
      { id: 'banking-and-finance', name: 'Banking & Finance' },
      { id: 'rural-and-urban-economy', name: 'Rural & Urban Economy' },
      { id: 'tamil-nadu-economy', name: 'Tamil Nadu Economy' },
    ],
  },
  {
    id: 'indian-national-movement',
    name: 'Indian National Movement',
    name_ta: 'இந்திய தேசிய இயக்கம்',
    topics: [
      { id: 'freedom-struggle', name: 'Freedom Struggle' },
      { id: 'national-leaders', name: 'National Leaders' },
      { id: 'role-of-tamil-nadu', name: 'Role of Tamil Nadu in Freedom Struggle' },
    ],
  },
  {
    id: 'tamil-nadu-history-and-society',
    name: 'History, Culture & Socio-Political Movements of Tamil Nadu',
    name_ta: 'தமிழ்நாட்டு வரலாறு மற்றும் சமூக இயக்கங்கள்',
    /**
     * The wording the published Tamil syllabus uses for this unit.
     *
     * A Group 4 booklet tags its questions in Tamil, and the phrasing is the
     * commission's, not the catalog's — without these the report cannot resolve
     * the subject and has no English label to show for it.
     */
    aliases: [
      'தமிழ்நாட்டின் வரலாறு, பண்பாடு, பாரம்பரியம் மற்றும் சமூக-அரசியல் இயக்கங்கள்',
      'History, Culture, Heritage and Socio-Political Movements of Tamil Nadu',
      // The same unit with the words in a different order. One paper tagged some
      // of its questions the Tamil way and others this way, which split the
      // subject into two rows until both wordings resolved here.
      'Tamil Nadu History, Culture & Socio-Political Movements',
      'Tamil Nadu History, Culture and Socio-Political Movements',
    ],
    topics: [
      { id: 'sangam-age', name: 'Sangam Age' },
      { id: 'tamil-society-and-culture', name: 'Tamil Society & Culture' },
      { id: 'dravidian-movement', name: 'Dravidian Movement' },
      { id: 'social-reformers', name: 'Social Reformers of Tamil Nadu' },
    ],
  },
  {
    id: 'development-administration-tn',
    name: 'Development Administration in Tamil Nadu',
    name_ta: 'தமிழ்நாட்டில் வளர்ச்சி நிர்வாகம்',
    topics: [
      { id: 'welfare-schemes-tn', name: 'Welfare Schemes of Tamil Nadu' },
      { id: 'human-development-indicators', name: 'Human Development Indicators' },
      { id: 'e-governance-tn', name: 'e-Governance in Tamil Nadu' },
    ],
  },
];

const APTITUDE_SUBJECT: TnpscSubject = {
  id: 'aptitude-and-mental-ability',
  name: 'Aptitude & Mental Ability',
  name_ta: 'திறனறிவு மற்றும் மனத்திறன்',
  /**
   * The wording the published Tamil syllabus uses for this unit.
   *
   * A Group 4 booklet tags its questions in Tamil, and the phrasing is the
   * commission's, not the catalog's — without these the report cannot resolve
   * the subject and has no English label to show for it.
   */
  aliases: [
    'திறனறிவு மற்றும் மனக்கணக்கு நுண்ணறிவு',
    'Aptitude and Mental Ability Test',
  ],
  topics: [
    { id: 'simplification-and-percentage', name: 'Simplification & Percentage' },
    { id: 'ratio-and-proportion', name: 'Ratio & Proportion' },
    { id: 'time-work-distance', name: 'Time, Work & Distance' },
    { id: 'number-series', name: 'Number Series' },
    { id: 'logical-reasoning', name: 'Logical Reasoning' },
    { id: 'data-interpretation', name: 'Data Interpretation' },
  ],
};

// Kept as two separate subjects on purpose. A Group 4 candidate sits one or the
// other, and the question generator resolves language from the *whole* subject
// name — "General Tamil" produces a Tamil paper on its own, while a combined
// "General Tamil / General English" would match neither rule.
const TAMIL_SUBJECT: TnpscSubject = {
  id: 'general-tamil',
  name: 'General Tamil',
  name_ta: 'பொதுத் தமிழ்',
  /**
   * The wording the published Tamil syllabus uses for this unit.
   *
   * A Group 4 booklet tags its questions in Tamil, and the phrasing is the
   * commission's, not the catalog's — without these the report cannot resolve
   * the subject and has no English label to show for it.
   */
  aliases: [
    'தமிழ் தகுதி மற்றும் மதிப்பீட்டுத் தேர்வு',
    // The shorter wording papers actually use — the full unit title above is what
    // the syllabus prints, but a booklet abbreviates it and the two do not match
    // as strings.
    'தமிழ் தகுதித் தேர்வு',
    'Tamil Eligibility-cum-Scoring Test',
    'Tamil Eligibility Test',
  ],
  topics: [
    { id: 'grammar', name: 'இலக்கணம் (Grammar)' },
    { id: 'literature', name: 'இலக்கியம் (Literature)' },
    { id: 'authors-and-works', name: 'ஆசிரியர்களும் நூல்களும் (Authors & Works)' },
    { id: 'comprehension', name: 'பொருள் உணர்தல் (Comprehension)' },
    { id: 'vocabulary', name: 'சொல்லறிவு (Vocabulary)' },
  ],
};

const ENGLISH_SUBJECT: TnpscSubject = {
  id: 'general-english',
  name: 'General English',
  topics: [
    { id: 'grammar', name: 'Grammar' },
    { id: 'literature', name: 'Literature' },
    { id: 'authors-and-works', name: 'Authors & Works' },
    { id: 'comprehension', name: 'Comprehension' },
    { id: 'vocabulary', name: 'Vocabulary' },
  ],
};

// ─── GAT-B syllabus ─────────────────────────────────────────────────────────────
// Section A is 10+2 level across four sciences; Section B is graduate-level
// biology/biotechnology. Kept as one flat subject list because the portal's
// practice track is per subject — the section split lives in `pattern.sections`
// and the per-subject question counts in src/data/examSyllabus.ts.

const GATB_SECTION_A_SUBJECTS: TnpscSubject[] = [
  {
    id: 'physics-12',
    name: 'Physics (10+2)',
    aliases: [
      'Physics',
      'Physics', 'Physics', 'Physics 10+2', 'General Physics'],
    topics: [
      { id: 'mechanics', name: 'Mechanics' },
      { id: 'thermodynamics-and-kinetic-theory', name: 'Thermodynamics & Kinetic Theory' },
      { id: 'optics-and-waves', name: 'Optics & Waves' },
      { id: 'electricity-and-magnetism', name: 'Electricity & Magnetism' },
      { id: 'modern-physics', name: 'Modern Physics' },
    ],
  },
  {
    id: 'chemistry-12',
    name: 'Chemistry (10+2)',
    aliases: [
      'Chemistry',
      'Chemistry', 'Chemistry', 'Chemistry 10+2', 'General Chemistry'],
    topics: [
      { id: 'atomic-structure-and-bonding', name: 'Atomic Structure & Chemical Bonding' },
      { id: 'physical-chemistry', name: 'Physical Chemistry' },
      { id: 'organic-chemistry', name: 'Organic Chemistry' },
      { id: 'inorganic-chemistry', name: 'Inorganic Chemistry' },
      { id: 'biomolecules-basics', name: 'Biomolecules' },
    ],
  },
  {
    id: 'mathematics-12',
    name: 'Mathematics (10+2)',
    aliases: [
      'Mathematics',
      'Mathematics', 'Mathematics', 'Maths', 'Math', 'Quantitative Aptitude', 'Mathematics 10+2'],
    topics: [
      { id: 'algebra', name: 'Algebra' },
      { id: 'calculus', name: 'Calculus' },
      { id: 'coordinate-geometry', name: 'Coordinate Geometry' },
      { id: 'probability-and-statistics', name: 'Probability & Statistics' },
      { id: 'matrices-and-determinants', name: 'Matrices & Determinants' },
    ],
  },
  {
    id: 'biology-12',
    name: 'Biology (10+2)',
    aliases: [
      'Biology',
      'Biology', 'Biology', 'Biology 10+2', 'General Biology', 'Basic Biology'],
    topics: [
      { id: 'cell-structure-and-function', name: 'Cell Structure & Function' },
      { id: 'plant-physiology', name: 'Plant Physiology' },
      { id: 'human-physiology', name: 'Human Physiology' },
      { id: 'genetics-and-evolution-basics', name: 'Genetics & Evolution' },
      { id: 'biology-in-human-welfare', name: 'Biology in Human Welfare' },
    ],
  },
];

const GATB_SECTION_B_SUBJECTS: TnpscSubject[] = [
  {
    id: 'biochemistry',
    name: 'Biochemistry',
    aliases: [
      'Biochemistry & Bioenergetics',
      'Biochemistry Bioenergetics', 'Biomolecules', 'Biochemistry and Metabolism', 'Metabolism', 'Enzymology'],
    topics: [
      { id: 'carbohydrates-and-lipids', name: 'Carbohydrates & Lipids' },
      { id: 'proteins-and-amino-acids', name: 'Proteins & Amino Acids' },
      { id: 'enzymes-and-kinetics', name: 'Enzymes & Enzyme Kinetics' },
      { id: 'metabolism-and-bioenergetics', name: 'Metabolism & Bioenergetics' },
      { id: 'vitamins-and-hormones', name: 'Vitamins & Hormones' },
    ],
  },
  {
    id: 'cell-biology',
    name: 'Cell Biology',
    aliases: [
      'Cell Biology & Cell Signalling',
      'Cell Biology Cell Signalling', 'Cell and Molecular Biology', 'Cytology', 'Cell Structure and Function'],
    topics: [
      { id: 'membrane-structure-and-transport', name: 'Membrane Structure & Transport' },
      { id: 'organelles-and-cytoskeleton', name: 'Organelles & Cytoskeleton' },
      { id: 'cell-cycle-and-division', name: 'Cell Cycle & Division' },
      { id: 'cell-signalling', name: 'Cell Signalling' },
      { id: 'apoptosis-and-cancer-biology', name: 'Apoptosis & Cancer Biology' },
    ],
  },
  {
    id: 'genetics',
    name: 'Genetics',
    aliases: [
      'Molecular Biology & Genetics',
      'Molecular Biology Genetics', 'Classical Genetics', 'Mendelian Genetics', 'Genetics and Heredity'],
    topics: [
      { id: 'mendelian-genetics', name: 'Mendelian Genetics' },
      { id: 'linkage-and-mapping', name: 'Linkage & Chromosome Mapping' },
      { id: 'mutations-and-repair', name: 'Mutations & DNA Repair' },
      { id: 'population-genetics', name: 'Population Genetics' },
      { id: 'human-and-medical-genetics', name: 'Human & Medical Genetics' },
    ],
  },
  {
    id: 'molecular-biology-and-rdna',
    name: 'Molecular Biology & rDNA Technology',
    aliases: [
      'Recombinant DNA & Genetic Engineering',
      'Recombinant DNA Technology & Genetic Engineering',
      'Recombinant DNA Genetic Engineering',
      'Recombinant DNA / Genetic Engineering',
      'Recombinant DNA Technology',
      'Genetic Engineering',
      'rDNA Technology',
      'Molecular Biology',
      'Gene Cloning',
      'Molecular Biology and Genetic Engineering',
    ],
    topics: [
      { id: 'dna-replication', name: 'DNA Replication' },
      { id: 'transcription-and-translation', name: 'Transcription & Translation' },
      { id: 'gene-regulation', name: 'Regulation of Gene Expression' },
      { id: 'cloning-vectors-and-hosts', name: 'Cloning Vectors & Host Systems' },
      { id: 'pcr-and-blotting', name: 'PCR, Blotting & Hybridisation' },
      { id: 'sequencing-and-genome-editing', name: 'Sequencing & Genome Editing' },
    ],
  },
  {
    id: 'microbiology',
    name: 'Microbiology',
    aliases: [
      'Microbiology & Virology',
      'Microbiology Virology', 'Microbiology and Virology', 'General Microbiology', 'Virology'],
    topics: [
      { id: 'microbial-classification', name: 'Microbial Classification & Diversity' },
      { id: 'microbial-growth-and-nutrition', name: 'Microbial Growth & Nutrition' },
      { id: 'microbial-genetics', name: 'Microbial Genetics' },
      { id: 'virology', name: 'Virology' },
      { id: 'industrial-and-food-microbiology', name: 'Industrial & Food Microbiology' },
    ],
  },
  {
    id: 'immunology',
    name: 'Immunology',
    aliases: [
      'Immunology',
      'Immunology', 'Immunology and Immunotechnology', 'Immunotechnology'],
    topics: [
      { id: 'innate-and-adaptive-immunity', name: 'Innate & Adaptive Immunity' },
      { id: 'antigens-and-antibodies', name: 'Antigens & Antibodies' },
      { id: 'mhc-and-antigen-presentation', name: 'MHC & Antigen Presentation' },
      { id: 'hypersensitivity-and-autoimmunity', name: 'Hypersensitivity & Autoimmunity' },
      { id: 'vaccines-and-immunotechniques', name: 'Vaccines & Immunotechniques' },
    ],
  },
  {
    id: 'plant-biotechnology',
    name: 'Plant Biotechnology',
    aliases: [
      'Plant Biotechnology',
      'Plant Biotechnology', 'Plant Biotech', 'Plant Tissue Culture', 'Plant Science'],
    topics: [
      { id: 'tissue-culture-and-micropropagation', name: 'Tissue Culture & Micropropagation' },
      { id: 'transgenic-plants', name: 'Transgenic Plants' },
      { id: 'plant-molecular-markers', name: 'Molecular Markers & Crop Improvement' },
      { id: 'secondary-metabolites', name: 'Secondary Metabolites' },
    ],
  },
  {
    id: 'animal-biotechnology',
    name: 'Animal Biotechnology & Cell Culture',
    aliases: [
      'Animal Biotechnology & Cell Culture',
      'Animal Biotechnology',
      'Animal Biotechnology', 'Animal Biotech', 'Animal Cell Culture', 'Animal Science', 'Animal Biotechnology'],
    topics: [
      { id: 'animal-cell-culture', name: 'Animal Cell Culture' },
      { id: 'transgenic-animals', name: 'Transgenic Animals' },
      { id: 'stem-cells-and-cloning', name: 'Stem Cells & Cloning' },
      { id: 'monoclonal-antibodies', name: 'Hybridoma & Monoclonal Antibodies' },
    ],
  },
  {
    id: 'bioprocess-engineering',
    name: 'Bioprocess Engineering & Technology',
    aliases: [
      'Bioprocess Engineering & Industrial Biotechnology',
      'Bioprocess Industrial Biotechnology', 'Bioprocess Technology', 'Bioprocess Engineering', 'Fermentation Technology', 'Bioreactor Design'],
    topics: [
      { id: 'bioreactor-design', name: 'Bioreactor Design & Operation' },
      { id: 'fermentation-and-kinetics', name: 'Fermentation & Growth Kinetics' },
      { id: 'sterilisation-and-media', name: 'Sterilisation & Media Design' },
      { id: 'downstream-processing', name: 'Downstream Processing' },
      { id: 'enzyme-immobilisation', name: 'Enzyme & Cell Immobilisation' },
    ],
  },
  {
    id: 'bioinformatics-and-biostatistics',
    name: 'Bioinformatics & Biostatistics',
    aliases: [
      'Bioinformatics & Computational Biology',
      'Bioinformatics Computational Biology', 'Bioinformatics', 'Biostatistics', 'Computational Biology', 'Biostatistics and Bioinformatics'],
    topics: [
      { id: 'biological-databases', name: 'Biological Databases' },
      { id: 'sequence-alignment', name: 'Sequence Alignment & BLAST' },
      { id: 'phylogenetics', name: 'Phylogenetic Analysis' },
      { id: 'descriptive-statistics', name: 'Descriptive Statistics' },
      { id: 'hypothesis-testing', name: 'Hypothesis Testing & Experimental Design' },
    ],
  },
  {
    id: 'ecology-and-evolution',
    name: 'Ecology, Evolution & Biodiversity',
    aliases: [
      'Ecology, Evolution & Biodiversity',
      'Ecology', 'Evolution', 'Biodiversity', 'Ecology and Biodiversity'],
    topics: [
      { id: 'ecosystems-and-energy-flow', name: 'Ecosystems & Energy Flow' },
      { id: 'population-and-community-ecology', name: 'Population & Community Ecology' },
      { id: 'evolutionary-mechanisms', name: 'Evolutionary Mechanisms' },
      { id: 'conservation-and-biodiversity', name: 'Conservation & Biodiversity' },
    ],
  },
  {
    id: 'analytical-techniques',
    name: 'Analytical Techniques',
    aliases: [
      'Analytical & Biophysical Techniques',
      'Analytical Biophysical Techniques', 'Analytical Techniques and Instrumentation', 'Instrumentation', 'Bioanalytical Techniques', 'Techniques in Biology'],
    topics: [
      { id: 'chromatography', name: 'Chromatography' },
      { id: 'electrophoresis', name: 'Electrophoresis' },
      { id: 'spectroscopy', name: 'Spectroscopy' },
      { id: 'centrifugation', name: 'Centrifugation' },
      { id: 'microscopy-and-imaging', name: 'Microscopy & Imaging' },
    ],
  },
];

// ─── Group 4 published syllabus ────────────────────────────────────────────────
//
// Unit names and question counts are transcribed from the TNPSC Combined Civil
// Services Examination – IV syllabus (Code 496, dated 12.12.2024). Counts are as
// printed and sum to their section: 75 + 25 + 100 = 200.

const G4_GENERAL_STUDIES_UNITS: TnpscSyllabusUnit[] = [
  {
    id: 'g4-gs-general-science',
    label: 'I',
    name: 'General Science',
    name_ta: 'பொது அறிவியல்',
    questions: 5,
    subject_ids: ['general-science'],
  },
  {
    id: 'g4-gs-geography',
    label: 'II',
    name: 'Geography',
    name_ta: 'புவியியல்',
    questions: 5,
    subject_ids: ['geography'],
  },
  {
    id: 'g4-gs-history-and-inm',
    label: 'III',
    name: 'History, Culture of India, and Indian National Movement',
    questions: 10,
    // One printed unit, two catalog subjects — the syllabus states no split between
    // them, so the 10 stays on the unit rather than being halved.
    subject_ids: ['history-and-culture', 'indian-national-movement'],
  },
  {
    id: 'g4-gs-indian-polity',
    label: 'IV',
    name: 'Indian Polity',
    name_ta: 'இந்திய அரசியலமைப்பு',
    questions: 15,
    subject_ids: ['indian-polity'],
  },
  {
    id: 'g4-gs-economy-and-dev-admin',
    label: 'V',
    name: 'Indian Economy and Development Administration in Tamil Nadu',
    questions: 20,
    subject_ids: ['indian-economy', 'development-administration-tn'],
  },
  {
    id: 'g4-gs-tamil-nadu-history',
    label: 'VI',
    name: 'History, Culture, Heritage, and Socio-Political Movements of Tamil Nadu',
    questions: 20,
    subject_ids: ['tamil-nadu-history-and-society'],
  },
];

const G4_APTITUDE_UNITS: TnpscSyllabusUnit[] = [
  {
    id: 'g4-apt-aptitude',
    label: 'I',
    name: 'Aptitude',
    questions: 15,
    topics: [
      { id: 'simplification', name: 'Simplification' },
      { id: 'percentage', name: 'Percentage' },
      { id: 'hcf-lcm', name: 'HCF & LCM' },
      { id: 'ratio-and-proportion', name: 'Ratio and Proportion' },
      { id: 'simple-interest', name: 'Simple interest' },
      { id: 'compound-interest', name: 'Compound interest' },
      { id: 'area', name: 'Area' },
      { id: 'volume', name: 'Volume' },
      { id: 'time-and-work', name: 'Time and Work' },
    ],
  },
  {
    id: 'g4-apt-reasoning',
    label: 'II',
    name: 'Reasoning',
    questions: 10,
    topics: [
      { id: 'logical-reasoning', name: 'Logical reasoning' },
      { id: 'puzzles', name: 'Puzzles' },
      { id: 'dice', name: 'Dice' },
      { id: 'visual-reasoning', name: 'Visual reasoning' },
      { id: 'alpha-numeric-reasoning', name: 'Alpha numeric reasoning' },
      { id: 'number-series', name: 'Number series' },
    ],
  },
];

// The Tamil eligibility-cum-scoring paper. Differently abled candidates may sit
// General English instead, whose seven units carry a different split (25 / 15 / 10 /
// 10 / 20 / 5 / 15) — noted on the section rather than listed twice.
const G4_TAMIL_UNITS: TnpscSyllabusUnit[] = [
  { id: 'g4-ta-grammar', label: 'I', name: 'Grammar', name_ta: 'இலக்கணம்', questions: 25 },
  { id: 'g4-ta-vocabulary', label: 'II', name: 'Vocabulary', name_ta: 'சொல்லகராதி', questions: 15 },
  { id: 'g4-ta-writing', label: 'III', name: 'Writing Skills', name_ta: 'எழுதும் திறன்', questions: 15 },
  { id: 'g4-ta-technical-terms', label: 'IV', name: 'Technical Terms', name_ta: 'கலைச் சொற்கள்', questions: 10 },
  {
    id: 'g4-ta-comprehension',
    label: 'V',
    name: 'Reading Comprehension',
    name_ta: 'வாசித்தல் – புரிந்து கொள்ளும் திறன்',
    questions: 15,
  },
  {
    id: 'g4-ta-translation',
    label: 'VI',
    name: 'Simple Translation',
    name_ta: 'எளிய மொழி பெயர்ப்பு',
    questions: 5,
  },
  {
    id: 'g4-ta-literature',
    label: 'VII',
    name: 'Literature, Tamil Scholars and Service to Tamil',
    name_ta: 'இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும்',
    questions: 15,
  },
];

// ─── Groups ────────────────────────────────────────────────────────────────────

export const TNPSC_GROUPS: TnpscGroup[] = [
  {
    id: 'group-1',
    name: 'TNPSC Group 1',
    short_name: 'Group 1',
    authority: 'Tamil Nadu Public Service Commission',
    exam_type: 'TNPSC Group 1',
    tagline: 'Combined Civil Services Examination — I',
    description:
      'Deputy Collector, Deputy Superintendent of Police, Assistant Commissioner and other Group 1 services.',
    accent: 'from-indigo-500 via-violet-500 to-purple-600',
    posts: ['Deputy Collector', 'DSP (Category-1)', 'Assistant Commissioner (Commercial Taxes)', 'District Revenue Officer'],
    stages: [
      {
        id: 'group-1-prelims',
        group_id: 'group-1',
        name: 'Preliminary Examination',
        short_name: 'Prelims',
        description: 'Single objective paper of 200 questions — General Studies with Aptitude & Mental Ability.',
        status: 'active',
        paper_type: 'objective',
        // Both objective papers are bilingual — every question repeated in Tamil.
        bilingual: true,
        secondary_language: 'ta',
        pattern: {
          total_questions: 200,
          total_marks: 300,
          duration_minutes: 180,
          negative_marking: false,
          sections: [
            {
              name: 'General Studies',
              questions: 175,
              syllabus_subject_ids: GENERAL_STUDIES_SUBJECTS.map(s => s.id),
            },
            {
              name: 'Aptitude & Mental Ability',
              questions: 25,
              syllabus_subject_ids: [APTITUDE_SUBJECT.id],
            },
          ],
        },
        subjects: [...GENERAL_STUDIES_SUBJECTS, APTITUDE_SUBJECT],
      },
      {
        id: 'group-1-mains',
        group_id: 'group-1',
        name: 'Main Written Examination',
        short_name: 'Mains',
        description: 'Three descriptive papers followed by the interview. Coming soon on the portal.',
        status: 'coming_soon',
        paper_type: 'descriptive',
        bilingual: false,
        secondary_language: null,
        subjects: [],
      },
    ],
  },
  {
    id: 'group-4',
    name: 'TNPSC Group 4',
    short_name: 'Group 4',
    authority: 'Tamil Nadu Public Service Commission',
    exam_type: 'TNPSC Group 4',
    tagline: 'Combined Civil Services Examination — IV (incl. VAO)',
    description:
      'Village Administrative Officer, Junior Assistant, Bill Collector, Typist and Steno-Typist posts.',
    accent: 'from-emerald-500 via-teal-500 to-cyan-600',
    posts: ['Village Administrative Officer', 'Junior Assistant', 'Bill Collector', 'Typist'],
    stages: [
      {
        id: 'group-4-written',
        group_id: 'group-4',
        name: 'Written Examination',
        short_name: 'Written',
        description: 'Single objective paper of 200 questions — General Tamil/English, General Studies and Aptitude.',
        status: 'active',
        paper_type: 'objective',
        // Every question repeated in Tamil.
        bilingual: true,
        secondary_language: 'ta',
        pattern: {
          total_questions: 200,
          total_marks: 300,
          duration_minutes: 180,
          negative_marking: false,
          sections: [
            {
              name: 'General Tamil / General English',
              questions: 100,
              syllabus_subject_ids: [TAMIL_SUBJECT.id, ENGLISH_SUBJECT.id],
              units: G4_TAMIL_UNITS,
              note: 'Differently abled candidates may sit General English instead — same 100 questions, split 25 / 15 / 10 / 10 / 20 / 5 / 15.',
            },
            {
              name: 'General Studies',
              questions: 75,
              syllabus_subject_ids: GENERAL_STUDIES_SUBJECTS.map(s => s.id),
              units: G4_GENERAL_STUDIES_UNITS,
            },
            {
              name: 'Aptitude & Mental Ability',
              questions: 25,
              syllabus_subject_ids: [APTITUDE_SUBJECT.id],
              units: G4_APTITUDE_UNITS,
            },
          ],
        },
        subjects: [TAMIL_SUBJECT, ENGLISH_SUBJECT, ...GENERAL_STUDIES_SUBJECTS, APTITUDE_SUBJECT],
      },
      {
        id: 'group-4-interview',
        group_id: 'group-4',
        name: 'Interview',
        short_name: 'Interview',
        description: 'Oral test round. Coming soon on the portal.',
        status: 'coming_soon',
        // No pattern or subjects: nothing about the round is published yet, and an
        // invented question count would render on the card as though it were real.
        paper_type: 'descriptive',
        bilingual: false,
        secondary_language: null,
        subjects: [],
      },
    ],
  },
  {
    id: 'gat-b',
    name: 'GAT-B',
    short_name: 'GAT-B',
    authority: 'DBT · Regional Centre for Biotechnology (NTA)',
    exam_type: 'GAT-B',
    tagline: 'Graduate Aptitude Test — Biotechnology',
    description:
      'Entrance to DBT-supported postgraduate biotechnology programmes (M.Sc./M.Tech./M.V.Sc.) across the participating universities, with the DBT-JRF linked studentship.',
    accent: 'from-lime-500 via-green-500 to-emerald-600',
    posts: [
      'M.Sc. Biotechnology',
      'M.Tech. Biotechnology',
      'M.V.Sc. Animal Biotechnology',
      'M.Sc. Agricultural Biotechnology',
    ],
    stages: [
      {
        id: 'gat-b-exam',
        group_id: 'gat-b',
        name: 'Graduate Aptitude Test — Biotechnology',
        short_name: 'GAT-B',
        description:
          'Single objective paper. Section A is 60 compulsory 10+2-level questions; Section B prints 100 graduate-level questions of which any 60 are answered.',
        status: 'active',
        paper_type: 'objective',
        // English-only paper — no second language, unlike both TNPSC stages.
        bilingual: false,
        secondary_language: null,
        pattern: {
          // 160 printed, 120 answered — the choice lives in Section B.
          total_questions: 160,
          total_attempted: 120,
          total_marks: 240,
          duration_minutes: 180,
          // Unlike TNPSC, GAT-B penalises wrong answers — and the two sections
          // penalise differently, so each carries its own value.
          negative_marking: true,
          sections: [
            {
              name: 'Section A — 10+2 Level',
              questions: 60,
              marks: 60,
              marks_per_question: 1,
              negative_mark_value: 0.5,
              subject_ids: GATB_SECTION_A_SUBJECTS.map(s => s.id),
            },
            {
              name: 'Section B — Graduate Level',
              questions: 100,
              attempt: 60,
              marks: 180,
              marks_per_question: 3,
              negative_mark_value: 1,
              subject_ids: GATB_SECTION_B_SUBJECTS.map(s => s.id),
            },
          ],
        },
        subjects: [...GATB_SECTION_A_SUBJECTS, ...GATB_SECTION_B_SUBJECTS],
      },
    ],
  },
];

// ─── Pattern display ───────────────────────────────────────────────────────────
// A paper that offers a choice prints more questions than it asks for, and its
// sections need not be marked alike. These four keep every surface that renders a
// pattern — stage page, group page, track page — saying the same thing.

/**
 * Questions as shown to the aspirant: "200" when every printed question is
 * answered, "120 of 160" when the paper offers a choice (GAT-B).
 */
export function questionCountLabel(pattern?: TnpscExamPattern): string | null {
  if (!pattern) return null;
  const { total_questions, total_attempted } = pattern;
  return total_attempted && total_attempted !== total_questions
    ? `${total_attempted} of ${total_questions}`
    : `${total_questions}`;
}

/** Questions actually answered in one sitting — the choice count where there is one. */
export function answeredCount(pattern?: TnpscExamPattern): number | undefined {
  return pattern?.total_attempted ?? pattern?.total_questions;
}

/** A section's question line: "75 Qs", or "any 60 of 100" when it offers a choice. */
export function sectionCountLabel(section: TnpscExamPattern['sections'][number]): string {
  return section.attempt && section.attempt !== section.questions
    ? `any ${section.attempt} of ${section.questions}`
    : `${section.questions} Qs`;
}

/**
 * How wrong answers are penalised, or null when they are not. Sections may each
 * carry their own deduction — GAT-B takes 0.5 in Section A and 1 in Section B, so
 * this reads "−0.5 / −1 per wrong answer".
 */
export function negativeMarkingLabel(pattern?: TnpscExamPattern): string | null {
  if (!pattern?.negative_marking) return null;
  const values = [
    ...new Set(
      pattern.sections
        .map(sec => sec.negative_mark_value ?? pattern.negative_mark_value)
        .filter((v): v is number => v != null),
    ),
  ];
  return values.length > 0 ? `−${values.join(' / −')} per wrong answer` : 'Negative marking';
}

/** One entry of `TnpscExamPattern.sections`. */
export type TnpscPatternSection = TnpscExamPattern['sections'][number];

/**
 * The active objective stage a generator `test_type` refers to, e.g. "GAT-B".
 *
 * Reads the bundled catalog rather than the server one: this answers "what does
 * this exam look like", which is a property of the build, and the admin panels
 * need it synchronously while configuring a paper.
 */
export function stageForExamType(examType?: string): TnpscStage | undefined {
  if (!examType) return undefined;
  const group = TNPSC_GROUPS.find(g => g.exam_type === examType);
  return group?.stages.find(st => st.status === 'active');
}

/** A subject's slug, given either the slug or its display name. Case-insensitive. */
/**
 * Compare subject names the way a reader would: case, punctuation, "&" vs "and",
 * slashes and the several spellings of 10+2 are all noise.
 *
 *   "Recombinant DNA / Genetic Engineering" -> "recombinant dna genetic engineering"
 *   "Molecular Biology & rDNA Technology"   -> "molecular biology and rdna technology"
 */
function subjectKey(s: string): string {
  return s
    .toLowerCase()
    // "&" and "and" are the same joiner, and a paper may use either or neither:
    // "Microbiology & Virology", "Microbiology and Virology" and
    // "Microbiology Virology" must all reduce to the same key.
    .replace(/&/g, ' ')
    .replace(/\band\b/g, ' ')
    .replace(/\b(?:10\s*\+\s*2|xii|12th|plus two|higher secondary)\b/g, '12')
    .replace(/[^a-z0-9+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The subject inside a question-collection name.
 *
 * Papers are built from collections named like `GATB_Section_B_Immunology_250` —
 * exam prefix, section marker, subject, pool size. Strip the wrapper so the
 * subject itself can be matched.
 */
function coreSubjectKey(s: string): string {
  return subjectKey(s)
    .replace(/^gatb\s+/, '')
    .replace(/^section\s+[ab]\s+/, '')
    .replace(/\s+\d+$/, '')
    .trim();
}

export function resolveSubjectId(stage: TnpscStage | undefined, subject?: string | null): string | undefined {
  if (!stage || !subject) return undefined;
  const needle = subjectKey(subject);
  if (!needle) return undefined;
  const core = coreSubjectKey(subject);

  for (const s of stage.subjects) {
    // `name_ta` belongs in here: a bilingual paper tags its questions in the
    // language it was printed in, so a Group 4 booklet names every subject in
    // Tamil. Without it such a subject resolves to nothing and loses its section,
    // its per-question marks and its English label.
    const candidates = [s.id, s.name, s.name_ta, ...(s.aliases ?? [])].filter(Boolean) as string[];
    if (candidates.some(c => subjectKey(c) === needle || subjectKey(c) === core)) return s.id;
  }
  return undefined;
}

/**
 * The catalog's name for a subject the paper tagged in its own words.
 *
 * Falls back to the paper's wording, which is better than an empty label — but
 * where the syllabus knows the subject, its canonical name is what a filter or a
 * report should show. Two wordings of one subject also collapse onto the same
 * name, so they stop appearing as two entries.
 */
export function subjectDisplayName(stage: TnpscStage | undefined, subject?: string | null): string {
  const raw = (subject ?? '').trim();
  const id = resolveSubjectId(stage, raw);
  if (!id) return raw;
  return stage?.subjects.find(s => s.id === id)?.name ?? raw;
}

/**
 * The section named outright by a label, e.g. `GATB_Section_B_Immunology_250`.
 *
 * The most reliable signal there is: the paper's own collections say which
 * section they belong to, so no subject-name guessing is involved. Only trusted
 * when the stage actually has two sections to choose between.
 */
export function sectionFromLabel(
  stage: TnpscStage | undefined,
  label?: string | null,
): TnpscPatternSection | undefined {
  const sections = stage?.pattern?.sections;
  if (!sections || !label) return undefined;

  // Matched against the normalised key rather than the raw string: in
  // `GATB_Section_B_Immunology_250` the underscore before "Section" is itself a
  // word character, so `\bsection` never fires on the original.
  const m = /\bsection\s+([ab])\b/.exec(subjectKey(label));
  if (!m) return undefined;

  // Resolved by the section's own name, not by position, so this only applies to a
  // paper whose sections really are called "Section A"/"Section B". TNPSC stages
  // have two sections as well — "General Studies" and "Aptitude" — and a label
  // mentioning a section must not silently match those.
  const wanted = new RegExp(`\\bsection\\s+${m[1]}\\b`);
  return sections.find(sec => wanted.test(subjectKey(sec.name)));
}

/**
 * The section a subject sits in, or undefined when the paper does not divide its
 * subjects between sections (both TNPSC stages).
 */
export function sectionForSubject(
  stage: TnpscStage | undefined,
  subject?: string | null,
): TnpscPatternSection | undefined {
  // A label that names its own section beats any name-based mapping.
  const declared = sectionFromLabel(stage, subject);
  if (declared) return declared;

  const id = resolveSubjectId(stage, subject);
  if (!id) return undefined;
  return stage?.pattern?.sections.find(sec => sec.subject_ids?.includes(id));
}

/**
 * What one correct answer in this subject is worth, when sections are weighted
 * differently. Undefined means "use the paper default" — GAT-B answers 1 for a
 * Section A subject and 3 for a Section B one.
 */
export function marksForSubject(stage: TnpscStage | undefined, subject?: string | null): number | undefined {
  return sectionForSubject(stage, subject)?.marks_per_question;
}

/**
 * The stage a paper belongs to, guessed from its title — "GAT-B-Easy" is a GAT-B
 * paper, "GAT-B-Trial-1" likewise.
 *
 * More reliable than the subject sweep below, because a paper's subject *names*
 * vary with whoever wrote it while the exam in its title does not. Tried first;
 * `stageForSubjects` remains the fallback for papers named without their exam.
 */
export function stageForTitle(title?: string | null): TnpscStage | undefined {
  if (!title) return undefined;
  const key = subjectKey(title);
  if (!key) return undefined;

  for (const group of TNPSC_GROUPS) {
    const needles = [group.exam_type, group.short_name, group.name]
      .map(subjectKey)
      .filter(n => n.length >= 4);
    if (needles.some(n => key.includes(n))) {
      return group.stages.find(st => st.status === 'active');
    }
  }
  return undefined;
}

/**
 * The stage a paper belongs to, identified from the subjects its questions carry.
 *
 * The take flow receives an assessment with no exam type on it, so the paper has to
 * identify itself. Returns the active stage matching the most subjects, and only when
 * a majority match — a single stray "Physics" must not drag a TNPSC paper into GAT-B.
 */
export function stageForSubjects(subjects: Array<string | null | undefined>): TnpscStage | undefined {
  const names = subjects.filter((n): n is string => !!n && n.trim() !== '');
  if (names.length === 0) return undefined;

  let best: { stage: TnpscStage; hits: number } | undefined;
  for (const group of TNPSC_GROUPS) {
    for (const stage of group.stages) {
      if (stage.status !== 'active') continue;
      const hits = names.filter(n => resolveSubjectId(stage, n)).length;
      if (hits > 0 && (!best || hits > best.hits)) best = { stage, hits };
    }
  }
  return best && best.hits * 2 >= names.length ? best.stage : undefined;
}

/** Deduction for a wrong answer in this subject, when sections differ. */
export function negativeForSubject(stage: TnpscStage | undefined, subject?: string | null): number | undefined {
  return sectionForSubject(stage, subject)?.negative_mark_value;
}

/**
 * Group questions by section, in the order the pattern lists them.
 *
 * A generated paper interleaves its sections — GAT-B came back with a Section B
 * question at number 1 — but the real paper is sat section by section: Section A's
 * 60 compulsory questions, then Section B's 100. Sorting here means the exam and
 * the report both number them the way the candidate expects.
 *
 * Stable: questions keep their relative order inside a section, and anything whose
 * section cannot be resolved is left at the end rather than dropped. A no-op for a
 * paper whose pattern does not divide its subjects between sections, which is every
 * TNPSC stage.
 */
export function orderBySection<T>(
  stage: TnpscStage | undefined,
  items: T[],
  subjectOf: (item: T) => string | null | undefined,
): T[] {
  const sections = stage?.pattern?.sections;
  if (!sections || sections.length < 2) return items;
  if (!sections.some(sec => sec.subject_ids?.length)) return items;

  const rank = new Map(sections.map((sec, i) => [sec.name, i]));
  return items
    .map((item, i) => {
      const name = sectionForSubject(stage, subjectOf(item))?.name;
      return { item, i, r: (name != null ? rank.get(name) : undefined) ?? sections.length };
    })
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.item);
}

/**
 * The subjects a section covers, in catalog order.
 *
 * Prefers the marking map when a paper has one (GAT-B), falls back to the
 * display-only map (both TNPSC stages), and returns every subject when a paper
 * declares neither — a single-section paper covers its whole syllabus.
 */
export function sectionSyllabus(
  stage: TnpscStage | undefined,
  section: TnpscPatternSection,
): TnpscSubject[] {
  const ids = section.subject_ids ?? section.syllabus_subject_ids;
  const subjects = stage?.subjects ?? [];
  if (!ids?.length) return (stage?.pattern?.sections.length ?? 0) <= 1 ? subjects : [];
  const wanted = new Set(ids);
  return subjects.filter(sub => wanted.has(sub.id));
}

/**
 * The topics printed under a syllabus unit.
 *
 * A unit either lists its own (the Group 4 aptitude units, transcribed from the
 * syllabus) or borrows them from the catalog subjects it covers.
 */
export function unitTopics(stage: TnpscStage | undefined, unit: TnpscSyllabusUnit): TnpscTopic[] {
  if (unit.topics?.length) return unit.topics;
  if (!unit.subject_ids?.length) return [];
  const wanted = new Set(unit.subject_ids);
  return (stage?.subjects ?? []).filter(sub => wanted.has(sub.id)).flatMap(sub => sub.topics);
}

/**
 * True when the sections of this paper disagree about what a wrong answer costs —
 * the case a single paper-wide deduction cannot express.
 */
export function hasPerSectionNegative(pattern?: TnpscExamPattern): boolean {
  if (!pattern?.negative_marking) return false;
  const values = new Set(
    pattern.sections.map(sec => sec.negative_mark_value ?? pattern.negative_mark_value ?? null),
  );
  return values.size > 1;
}

/**
 * The least punitive deduction in the paper.
 *
 * Sent as the flat `negative_mark_value` alongside the per-section list so a backend
 * that does not yet understand sections under-penalises rather than over-penalises —
 * a mock that is too lenient is recoverable, one that invents lost marks is not.
 */
export function leastNegative(pattern?: TnpscExamPattern): number | undefined {
  const values = (pattern?.sections ?? [])
    .map(sec => sec.negative_mark_value ?? pattern?.negative_mark_value)
    .filter((v): v is number => v != null);
  return values.length > 0 ? Math.min(...values) : pattern?.negative_mark_value;
}

// ─── Lookups ───────────────────────────────────────────────────────────────────

export function findGroup(groupId?: string, catalog: TnpscGroup[] = TNPSC_GROUPS): TnpscGroup | undefined {
  return catalog.find(g => g.id === groupId);
}

export function findStage(
  groupId?: string,
  stageId?: string,
  catalog: TnpscGroup[] = TNPSC_GROUPS,
): { group: TnpscGroup; stage: TnpscStage } | undefined {
  const group = findGroup(groupId, catalog);
  const stage = group?.stages.find(s => s.id === stageId);
  return group && stage ? { group, stage } : undefined;
}

/**
 * The language a paper of this exam type is repeated in, or null when it is
 * single-language. `testType` is the generator's value — "TNPSC Group 4".
 *
 * Both Group 1 Prelims and Group 4 Written are bilingual (Tamil alongside English).
 * Group 1 Mains is descriptive and has no generated paper, so it stays null.
 */
export function bilingualLanguageForExamType(testType?: string): 'ta' | 'en' | null {
  if (!testType) return null;
  const group = TNPSC_GROUPS.find(g => g.name === testType || g.short_name === testType);
  const stage = group?.stages.find(s => s.status === 'active' && s.bilingual);
  return stage?.secondary_language ?? null;
}

/** First navigable stage of a group — used when a group card is clicked. */
export function defaultStage(group: TnpscGroup): TnpscStage | undefined {
  return group.stages.find(s => s.status === 'active') ?? group.stages[0];
}
