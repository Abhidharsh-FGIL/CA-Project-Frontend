/**
 * SSC CHSL (Combined Higher Secondary Level, 10+2) — Staff Selection Commission, 2026.
 *
 * Two computer-based tests are sat. Tier I is a screening test and Tier II is the one the merit list is made from; the
 * aspirant prepares for each on its own, so each is an exam of its own in the catalog (`ssc-chsl-tier-1`,
 * `ssc-chsl-tier-2`, one stage apiece), the way RRB NTPC's CBT-1 and CBT-2 are. The Skill Test (data entry) and the
 * Typing Test, and Document Verification, are not objective tests and are not stages — typing and data-entry speed
 * practice stays outside the question bank.
 *
 * The two tiers share one question bank. A question is tagged with a subject, a topic (the unit) and a sub-topic, and
 * those names are the same in both tiers; only the pattern differs (Tier I: 100 questions, 2 marks each; Tier II: 135
 * questions, 3 marks each, with Computer Knowledge added). Units therefore have the same names in both exams and
 * different ids (`c1-…`, `c2-…`), as NTPC's `n1-…` and `n2-…` do.
 *
 * The units and topics are the project's own organisation of the 2026 syllabus (see `BACKEND_SSC_CHSL.md`); the commission
 * publishes the topic list but no unit-wise question counts; Tier I's units carry the content team's split
 * (`TIER1_UNIT_QUESTIONS`), Tier II's none yet.
 *
 * Ids are the same on the portal and the backend (no wire mapping), as for TNPSC Group 4 and GAT-B.
 */
import type { TnpscGroup, TnpscSubject, TnpscSyllabusUnit, TnpscTopic } from './tnpsc';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** A unit: its name and the topics under it, in the order the syllabus lists them. */
type U = readonly [name: string, topics: readonly string[]];

// ─── Subjects and their units ────────────────────────────────────────────────

const ENGLISH: readonly U[] = [
  ['Vocabulary', ['Synonyms and antonyms', 'Homonyms', 'One-word substitution', 'Idioms and phrases', 'Correct usage of words']],
  ['Spelling', ['Correct and incorrect spellings', 'Detecting misspelt words']],
  ['Grammar', ['Spot the error', 'Fill in the blanks', 'Sentence improvement', 'Grammar and sentence structure']],
  ['Sentence Transformation', ['Active and passive voice', 'Direct and indirect speech', 'Sentence-part rearrangement']],
  ['Comprehension', ['Cloze passage', 'Reading comprehension', 'Rearrangement of sentences in a passage']],
];

const REASONING: readonly U[] = [
  ['Analogy', ['Semantic analogy', 'Symbolic and number analogy', 'Figural analogy']],
  ['Classification', ['Semantic classification', 'Symbolic and number classification', 'Figural classification']],
  ['Series and Patterns', ['Number series', 'Semantic series', 'Figural series', 'Trends and pattern completion']],
  ['Coding and Operations', ['Coding and decoding', 'Word building', 'Numerical operations', 'Symbolic operations']],
  [
    'Spatial and Non-Verbal Reasoning',
    ['Space orientation', 'Venn diagrams', 'Embedded figures', 'Punched-hole questions', 'Paper folding and unfolding', 'Figural pattern folding and completion'],
  ],
  ['Logical and Analytical Reasoning', ['Drawing inferences', 'Critical thinking', 'Problem solving']],
  ['Intelligence and Social Reasoning', ['Emotional intelligence', 'Social intelligence']],
];

const ALGEBRA_GEOMETRY: readonly U[] = [
  ['Algebra', ['Basic algebraic identities', 'Elementary surds', 'Graphs of linear equations']],
  [
    'Geometry',
    ['Triangles and their centres', 'Congruence and similarity of triangles', 'Circles and chords', 'Tangents', 'Angles subtended by chords', 'Common tangents to circles'],
  ],
  [
    'Mensuration',
    ['Triangles and quadrilaterals', 'Regular polygons and circles', 'Prisms and pyramids', 'Cones and cylinders', 'Spheres and hemispheres', 'Rectangular parallelepipeds'],
  ],
  ['Trigonometry', ['Trigonometric ratios', 'Degree and radian measures', 'Standard identities', 'Complementary angles', 'Heights and distances']],
];

const MATHS_START: readonly U[] = [
  ['Number Systems', ['Whole numbers', 'Decimals and fractions', 'Relationship between numbers']],
  [
    'Fundamental Arithmetic',
    [
      'Percentages',
      'Ratio and proportion',
      'Square roots',
      'Averages',
      'Simple and compound interest',
      'Profit and loss',
      'Discount',
      'Partnership',
      'Mixture and alligation',
      'Time and distance',
      'Time and work',
    ],
  ],
];

/**
 * Tier I's syllabus is the commission's shorter "Basic Arithmetic and Quantitative Aptitude" list of 18 topics, not Tier
 * II's detailed one. They are grouped into the same seven units (so the `c1-` unit ids do not change), each topic as the
 * syllabus names it.
 */
const MATHS_1: readonly U[] = [
  ['Number Systems', ['Number systems', 'Fundamental arithmetic operations', 'Decimals and fractions']],
  [
    'Fundamental Arithmetic',
    [
      'Percentages',
      'Ratio and proportion',
      'Averages',
      'Interest',
      'Profit and loss',
      'Discount',
      'Partnership',
      'Mixture and alligation',
      'Time and work',
      'Time, speed and distance',
    ],
  ],
  ['Algebra', ['Basic algebra']],
  ['Geometry', ['Geometry']],
  ['Mensuration', ['Mensuration']],
  ['Trigonometry', ['Trigonometry']],
  ['Data Interpretation', ['Tables, graphs and basic data interpretation']],
];
const MATHS_2: readonly U[] = [
  ...MATHS_START,
  ...ALGEBRA_GEOMETRY,
  [
    'Statistics and Probability',
    ['Tables and graphs', 'Histograms', 'Frequency polygons', 'Bar diagrams and pie charts', 'Mean, median and mode', 'Standard deviation', 'Simple probability'],
  ],
];

const AWARENESS: readonly U[] = [
  ['Current Affairs', ['National and international events', 'Government schemes and initiatives', 'Awards and honours', 'Important appointments', 'Sports events and achievements']],
  ['History', ['Ancient Indian history', 'Medieval Indian history', 'Modern Indian history', 'Indian freedom struggle']],
  ['Geography', ['Indian geography', 'World geography', 'Physical geography', 'Rivers, mountains, climate and natural resources']],
  [
    'Indian Polity and General Policy',
    ['Indian Constitution', 'Fundamental rights and duties', 'Parliament and government structure', 'President, Prime Minister and judiciary', 'Important constitutional provisions'],
  ],
  ['Economy', ['Basic economic concepts', 'Indian economy', 'Banking and finance basics', 'Budget and economic developments']],
  ['General Science', ['Physics', 'Chemistry', 'Biology', 'Everyday scientific observations and applications']],
  [
    'Culture and Miscellaneous General Knowledge',
    ['Indian art and culture', 'Literature', 'Important monuments and heritage', 'Scientific research and developments', 'India and neighbouring countries'],
  ],
];

const COMPUTER: readonly U[] = [
  [
    'Computer Fundamentals',
    ['Organisation of a computer', 'Central Processing Unit (CPU)', 'Input and output devices', 'Computer memory', 'Memory organisation', 'Backup devices', 'Computer ports'],
  ],
  ['Operating Systems', ['Windows operating system', 'Windows Explorer', 'Basic file and folder operations', 'Keyboard shortcuts']],
  ['Microsoft Office', ['MS Word', 'MS Excel', 'MS PowerPoint', 'Basic functions and commonly used commands']],
  ['Internet and Email', ['Web browsing and searching', 'Downloading and uploading', 'Managing email accounts', 'E-banking']],
  ['Networking', ['Basics of computer networks', 'Networking devices', 'Network protocols']],
  ['Cyber Security', ['Hacking', 'Computer viruses', 'Worms and Trojans', 'Network and information security threats', 'Preventive measures']],
];

// ─── The catalog ─────────────────────────────────────────────────────────────

interface Sub {
  id: string;
  name: string;
}

/**
 * The subjects. Names are what a question's Subject cell says in an upload sheet, so they are the same in both tiers —
 * Tier II calls its Maths section "Mathematical Abilities", but a question is still filed under Quantitative Aptitude.
 */
const SUBJECT = {
  english: { id: 'chsl-english', name: 'English Language' },
  reasoning: { id: 'chsl-reasoning', name: 'General Intelligence and Reasoning' },
  quant: { id: 'chsl-quant', name: 'Quantitative Aptitude' },
  awareness: { id: 'chsl-general-awareness', name: 'General Awareness' },
  computer: { id: 'chsl-computer', name: 'Computer Knowledge' },
} satisfies Record<string, Sub>;

const topicsOf = (u: U): TnpscTopic[] => u[1].map(name => ({ id: slug(name), name }));

/** A subject for the stage's list: its own topics are its units, which is how a paper tagged with a unit's name finds its place. */
const subjectOf = (s: Sub, units: readonly U[]): TnpscSubject => ({
  id: s.id,
  name: s.name,
  topics: units.map(u => ({ id: slug(u[0]), name: u[0] })),
});

/**
 * Tier I's split of its 100 questions by unit — the content team's distribution, not the commission's (it publishes
 * section totals only). Its Maths rows name Tier I's 18 syllabus topics; they are summed into the unit each belongs to:
 * Number Systems = number systems 2 + fundamental arithmetic operations 2 + decimals and fractions 1; Fundamental
 * Arithmetic = percentages 2, ratio 1, averages 1, interest 1, profit and loss 1, discount 1, partnership 1, mixture 1,
 * time and work 2, time, speed and distance 2. Each section adds up to its 25. Tier II has no split yet.
 */
const TIER1_UNIT_QUESTIONS: Record<string, number> = {
  // English Language
  Vocabulary: 6,
  Spelling: 3,
  Grammar: 7,
  'Sentence Transformation': 4,
  Comprehension: 5,
  // General Intelligence and Reasoning
  Analogy: 4,
  Classification: 4,
  'Series and Patterns': 5,
  'Coding and Operations': 4,
  'Spatial and Non-Verbal Reasoning': 4,
  'Logical and Analytical Reasoning': 2,
  'Intelligence and Social Reasoning': 2,
  // Quantitative Aptitude
  'Number Systems': 5,
  'Fundamental Arithmetic': 13,
  Algebra: 1,
  Geometry: 2,
  Mensuration: 1,
  Trigonometry: 1,
  'Data Interpretation': 2,
  // General Awareness
  'Current Affairs': 4,
  History: 4,
  Geography: 3,
  'Indian Polity and General Policy': 4,
  Economy: 3,
  'General Science': 4,
  'Culture and Miscellaneous General Knowledge': 3,
};

/** A subject's units for one tier: ids carry the tier (`c1-` Tier I, `c2-` Tier II) and the subject. */
const unitsOf = (prefix: 'c1' | 'c2', s: Sub, units: readonly U[]): TnpscSyllabusUnit[] =>
  units.map((u, i) => ({
    id: `${prefix}-${slug(s.name)}-${slug(u[0])}`,
    label: ROMAN[i + 1],
    name: u[0],
    ...(prefix === 'c1' && TIER1_UNIT_QUESTIONS[u[0]] ? { questions: TIER1_UNIT_QUESTIONS[u[0]] } : {}),
    subject_ids: [s.id],
    topics: topicsOf(u),
  }));

interface Part {
  subject: Sub;
  /** The section's name in this tier's paper. */
  section: string;
  questions: number;
  /** Marks per correct answer. */
  each: number;
  units: readonly U[];
  note?: string;
}

function tier(n: 1 | 2, o: { name: string; tagline: string; description: string; accent: string; pattern: string; minutes: number; negative: number; parts: Part[] }): TnpscGroup {
  const prefix = n === 1 ? 'c1' : 'c2';
  const id = `ssc-chsl-tier-${n}` as TnpscGroup['id'];
  const total = o.parts.reduce((t, p) => t + p.questions, 0);
  const marks = o.parts.reduce((t, p) => t + p.questions * p.each, 0);
  return {
    id,
    name: o.name,
    short_name: o.name,
    authority: 'Staff Selection Commission (SSC)',
    exam_type: `SSC CHSL Tier-${n}`,
    tagline: o.tagline,
    description: o.description,
    accent: o.accent,
    posts: ['Lower Division Clerk (LDC)', 'Junior Secretariat Assistant (JSA)', 'Data Entry Operator (DEO)', "Data Entry Operator Grade 'A'"],
    stages: [
      {
        id: `${id}-exam` as TnpscGroup['stages'][number]['id'],
        group_id: id,
        name: `Tier ${n === 1 ? 'I' : 'II'} — ${n === 1 ? 'Screening' : 'Main'} Computer-Based Examination`,
        short_name: `Tier ${n === 1 ? 'I' : 'II'}`,
        description: o.pattern,
        status: 'active',
        paper_type: 'objective',
        bilingual: false,
        secondary_language: null,
        pattern: {
          total_questions: total,
          total_marks: marks,
          duration_minutes: o.minutes,
          negative_marking: true,
          negative_mark_value: o.negative,
          sections: o.parts.map(p => ({
            name: p.section,
            questions: p.questions,
            marks: p.questions * p.each,
            marks_per_question: p.each,
            negative_mark_value: o.negative,
            subject_ids: [p.subject.id],
            syllabus_subject_ids: [p.subject.id],
            units: unitsOf(prefix, p.subject, p.units),
            ...(p.note ? { note: p.note } : {}),
          })),
        },
        subjects: o.parts.map(p => subjectOf(p.subject, p.units)),
      },
    ],
  };
}

export const SSC_CHSL_GROUPS: TnpscGroup[] = [
  tier(1, {
    name: 'SSC CHSL Tier-1',
    tagline: 'Combined Higher Secondary (10+2) Level — Tier I',
    description:
      'First-stage computer-based test of the SSC CHSL recruitment for LDC, JSA and DEO posts. A screening test: Tier I marks are not added to the final merit.',
    accent: 'from-teal-500 via-emerald-500 to-green-600',
    pattern:
      'Objective computer-based test of 100 questions in 60 minutes — English Language, General Intelligence and Reasoning, Quantitative Aptitude and General Awareness, 25 questions and 15 minutes each. 2 marks for a correct answer, 0.50 off for a wrong one.',
    minutes: 60,
    negative: 0.5,
    parts: [
      { subject: SUBJECT.english, section: 'English Language', questions: 25, each: 2, units: ENGLISH, note: '15 minutes' },
      { subject: SUBJECT.reasoning, section: 'General Intelligence and Reasoning', questions: 25, each: 2, units: REASONING, note: '15 minutes' },
      { subject: SUBJECT.quant, section: 'Quantitative Aptitude', questions: 25, each: 2, units: MATHS_1, note: '15 minutes' },
      { subject: SUBJECT.awareness, section: 'General Awareness', questions: 25, each: 2, units: AWARENESS, note: '15 minutes' },
    ],
  }),
  tier(2, {
    name: 'SSC CHSL Tier-2',
    tagline: 'Combined Higher Secondary (10+2) Level — Tier II',
    description:
      'Main computer-based test of the SSC CHSL recruitment. Sections I and II carry the merit marks; the Computer Knowledge Test is qualifying. The Skill Test or Typing Test that follows is qualifying and is not part of the question bank.',
    accent: 'from-lime-500 via-green-500 to-emerald-600',
    pattern:
      'Objective computer-based test of 135 questions in 2 hours 15 minutes, with a time limit for each section. 3 marks for a correct answer, 1 off for a wrong one. Computer Knowledge is qualifying.',
    minutes: 135,
    negative: 1,
    parts: [
      { subject: SUBJECT.quant, section: 'Mathematical Abilities', questions: 30, each: 3, units: MATHS_2, note: 'Section I · 30 minutes' },
      { subject: SUBJECT.reasoning, section: 'Reasoning and General Intelligence', questions: 30, each: 3, units: REASONING, note: 'Section I · 30 minutes' },
      { subject: SUBJECT.english, section: 'English Language and Comprehension', questions: 40, each: 3, units: ENGLISH, note: 'Section II · 40 minutes' },
      { subject: SUBJECT.awareness, section: 'General Awareness', questions: 20, each: 3, units: AWARENESS, note: 'Section II · 20 minutes' },
      { subject: SUBJECT.computer, section: 'Computer Knowledge Test', questions: 15, each: 3, units: COMPUTER, note: 'Section III · 15 minutes · qualifying' },
    ],
  }),
];

/** The stage each SSC CHSL exam's papers live under. */
export const SSC_CHSL_STAGE: Record<string, string> = {
  'ssc-chsl-tier-1': 'ssc-chsl-tier-1-exam',
  'ssc-chsl-tier-2': 'ssc-chsl-tier-2-exam',
};

/**
 * The names an SSC CHSL aspirant reads in Tamil or Hindi: every subject, section and unit of both tiers, as
 * `[English, Tamil, Hindi]`. Registered with the RRB NTPC names (`ntpcLabel`), which is what the Exams pages translate
 * through for both exams. Where NTPC already has a name ("Classification", "Mensuration", "General Science"), NTPC's
 * wording is kept, so the two exams read alike.
 */
export const SSC_CHSL_NAMES: ReadonlyArray<readonly [en: string, ta: string, hi: string]> = [
  // Subjects and sections
  ['English Language', 'ஆங்கில மொழி', 'अंग्रेज़ी भाषा'],
  ['Quantitative Aptitude', 'அளவுசார் திறனறிவு', 'मात्रात्मक योग्यता'],
  ['Computer Knowledge', 'கணினி அறிவு', 'कंप्यूटर ज्ञान'],
  ['Mathematical Abilities', 'கணிதத் திறன்கள்', 'गणितीय क्षमताएँ'],
  ['Reasoning and General Intelligence', 'பகுத்தறிவு மற்றும் பொது அறிவுத்திறன்', 'तर्कशक्ति एवं सामान्य बुद्धिमत्ता'],
  ['English Language and Comprehension', 'ஆங்கில மொழி மற்றும் புரிதல்', 'अंग्रेज़ी भाषा एवं बोधगम्यता'],
  ['Computer Knowledge Test', 'கணினி அறிவுத் தேர்வு', 'कंप्यूटर ज्ञान परीक्षा'],
  // English Language
  ['Vocabulary', 'சொல்லகராதி', 'शब्दावली'],
  ['Spelling', 'எழுத்துக்கூட்டல்', 'वर्तनी'],
  ['Grammar', 'இலக்கணம்', 'व्याकरण'],
  ['Sentence Transformation', 'வாக்கிய மாற்றம்', 'वाक्य रूपांतरण'],
  ['Comprehension', 'புரிந்துகொள்ளுதல்', 'बोधगम्यता'],
  // General Intelligence and Reasoning
  ['Analogy', 'ஒப்புமை', 'सादृश्यता'],
  ['Classification', 'வகைப்படுத்துதல்', 'वर्गीकरण'],
  ['Series and Patterns', 'தொடர்கள் மற்றும் வடிவங்கள்', 'श्रृंखला और पैटर्न'],
  ['Coding and Operations', 'குறியீடாக்கம் மற்றும் செயல்பாடுகள்', 'कोडिंग और संक्रियाएँ'],
  ['Spatial and Non-Verbal Reasoning', 'இடஞ்சார்ந்த மற்றும் சொல்லற்ற பகுத்தறிவு', 'स्थानिक और गैर-मौखिक तर्कशक्ति'],
  ['Logical and Analytical Reasoning', 'தருக்க மற்றும் பகுப்பாய்வுப் பகுத்தறிவு', 'तार्किक और विश्लेषणात्मक तर्कशक्ति'],
  ['Intelligence and Social Reasoning', 'அறிவுத்திறன் மற்றும் சமூகப் பகுத்தறிவு', 'बुद्धिमत्ता और सामाजिक तर्कशक्ति'],
  // Quantitative Aptitude / Mathematical Abilities
  ['Number Systems', 'எண் முறைமைகள்', 'संख्या पद्धतियाँ'],
  ['Fundamental Arithmetic', 'அடிப்படை எண்கணிதம்', 'मूल अंकगणित'],
  ['Algebra', 'இயற்கணிதம்', 'बीजगणित'],
  ['Geometry', 'வடிவியல்', 'ज्यामिति'],
  ['Mensuration', 'அளவியல்', 'क्षेत्रमिति'],
  ['Trigonometry', 'முக்கோணவியல்', 'त्रिकोणमिति'],
  ['Data Interpretation', 'தரவு விளக்கம்', 'आँकड़ों की व्याख्या'],
  ['Statistics and Probability', 'புள்ளியியல் மற்றும் நிகழ்தகவு', 'सांख्यिकी और प्रायिकता'],
  // General Awareness
  ['Current Affairs', 'நடப்பு நிகழ்வுகள்', 'समसामयिक घटनाएँ'],
  ['History', 'வரலாறு', 'इतिहास'],
  ['Geography', 'புவியியல்', 'भूगोल'],
  ['Indian Polity and General Policy', 'இந்திய அரசியல் மற்றும் பொதுக் கொள்கை', 'भारतीय राजव्यवस्था और सामान्य नीति'],
  ['Economy', 'பொருளாதாரம்', 'अर्थव्यवस्था'],
  ['General Science', 'பொது அறிவியல்', 'सामान्य विज्ञान'],
  ['Culture and Miscellaneous General Knowledge', 'பண்பாடு மற்றும் பல்வகை பொது அறிவு', 'संस्कृति और विविध सामान्य ज्ञान'],
  // Computer Knowledge (Tier II)
  ['Computer Fundamentals', 'கணினி அடிப்படைகள்', 'कंप्यूटर के मूल सिद्धांत'],
  ['Operating Systems', 'இயக்க முறைமைகள்', 'ऑपरेटिंग सिस्टम'],
  ['Microsoft Office', 'மைக்ரோசாஃப்ட் ஆஃபீஸ்', 'माइक्रोसॉफ्ट ऑफिस'],
  ['Internet and Email', 'இணையம் மற்றும் மின்னஞ்சல்', 'इंटरनेट और ईमेल'],
  ['Networking', 'கணினி வலையமைப்பு', 'नेटवर्किंग'],
  ['Cyber Security', 'இணையப் பாதுகாப்பு', 'साइबर सुरक्षा'],
];
