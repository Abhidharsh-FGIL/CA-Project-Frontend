/**
 * RRB NTPC (Non-Technical Popular Categories) — the Railway Recruitment Boards' graduate and under-graduate posts.
 *
 * Two computer-based tests are sat, CBT 1 (a screening test) and CBT 2 (the one the merit list is made from). The
 * syllabus is common to both stages and to both levels (Graduate, CEN 06/2026, and Under-Graduate, CEN 07/2026);
 * only the question counts differ. The aspirant prepares for each test on its own, so each is its own exam in the
 * catalog — `rrb-ntpc-cbt-1` and `rrb-ntpc-cbt-2`, one stage apiece — and the Exams page, the dashboard filter and the
 * admin placement pickers list them beside the TNPSC exams. Document Verification and the Medical Examination are
 * not tests, so they are not stages.
 *
 * The types come from `tnpsc.ts`, which imports this file for the data; the import here is type-only so the two do not
 * load each other.
 */
import type { TnpscGroup, TnpscSubject, TnpscSyllabusUnit, TnpscTopic } from './tnpsc';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** "Basic operations; Real numbers" → topics. */
const topics = (list: string): TnpscTopic[] =>
  list
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => ({ id: slug(name), name }));

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII'];

/** A subject, and its units numbered as the syllabus prints them. */
function build(prefix: string, subjectId: string, name: string, rows: Array<[string, string]>): { subject: TnpscSubject; units: TnpscSyllabusUnit[] } {
  const units: TnpscSyllabusUnit[] = rows.map(([unitName, covered], i) => ({
    id: `ntpc-${prefix}-${slug(unitName)}`,
    label: ROMAN[i + 1],
    name: unitName,
    subject_ids: [subjectId],
    topics: topics(covered),
  }));
  // The subject's own topics are its units, which is how a paper tagged with a unit's name finds its place.
  const subject: TnpscSubject = { id: subjectId, name, topics: rows.map(([unitName]) => ({ id: slug(unitName), name: unitName })) };
  return { subject, units };
}

const MATHS = build('maths', 'ntpc-mathematics', 'Mathematics', [
  ['Number System', 'Natural numbers; Whole numbers; Integers; Rational numbers; Irrational numbers; Real numbers; Basic operations'],
  ['Decimals and Fractions', 'Decimal operations; Fractions; Conversion between fractions and decimals; Comparison and simplification'],
  ['LCM and HCF', 'Factors; Multiples; Prime factorisation; Finding LCM and HCF; Application-based problems'],
  ['Ratio and Proportion', 'Ratios; Equivalent ratios; Direct and inverse proportion; Partnership-related applications'],
  ['Percentage', 'Percentage calculations; Percentage increase and decrease; Successive percentage changes'],
  ['Mensuration', 'Perimeter; Area; Surface area and volume of common two-dimensional and three-dimensional shapes'],
  ['Time and Work', 'Work efficiency; Individual and combined work; Wages and work-related problems'],
  ['Time and Distance', 'Speed; Distance; Time; Average speed; Trains and related problems'],
  ['Simple and Compound Interest', 'Principal; Rate; Time; Simple interest; Compound interest; Difference between the two'],
  ['Profit and Loss', 'Cost price; Selling price; Profit; Loss; Discount; Marked price'],
  ['Elementary Algebra', 'Algebraic expressions; Identities; Equations; Basic algebraic operations'],
  ['Geometry and Trigonometry', 'Basic geometrical concepts; Lines; Angles; Triangles; Circles; Elementary trigonometric ratios and applications'],
  ['Elementary Statistics', 'Collection and interpretation of data; Averages; Mean; Median; Mode; Basic statistical interpretation'],
]);

const REASONING = build('reasoning', 'ntpc-reasoning', 'General Intelligence and Reasoning', [
  ['Analogies', 'Number analogies; Letter analogies; Word analogies; Figure analogies'],
  ['Number Series', 'Number patterns; Missing numbers; Sequence completion'],
  ['Alphabetical Series', 'Letter sequences; Alphabetical patterns; Missing letters'],
  ['Coding and Decoding', 'Letter coding; Number coding; Symbol coding; Coded relationships'],
  ['Mathematical Operations', 'Symbol substitution; Mathematical expressions; Operator-based problems'],
  ['Similarities and Differences', 'Common features; Differences; Relationships'],
  ['Relationships', 'Blood relations; Family relationships; Logical relationship problems'],
  ['Analytical Reasoning', 'Logical analysis; Deductions; Multi-condition problems'],
  ['Syllogism', 'Statements; Conclusions; Logical relationships; Venn diagram-based questions'],
  ['Jumbling', 'Arrangement and rearrangement of letters; Words; Numbers; Sequences'],
  ['Venn Diagrams', 'Set relationships; Overlapping groups; Classification'],
  ['Puzzles', 'Seating arrangements; Ordering; Grouping; Other logical puzzles'],
  ['Data Sufficiency', 'Deciding whether the given information is sufficient to answer a question'],
  ['Statement and Conclusion', 'Evaluating conclusions based on given statements'],
  ['Statement and Courses of Action', 'Selecting logical actions based on a given situation'],
  ['Decision Making', 'Situation-based reasoning; Logical decision-making'],
  ['Maps and Graph Interpretation', 'Direction and map-based problems; Interpretation of graphs and visual data'],
]);

const AWARENESS = build('ga', 'ntpc-general-awareness', 'General Awareness', [
  ['Current Events', 'National and international current affairs; Important events; Appointments; Awards; Developments'],
  ['Games and Sports', 'National and international sports; Tournaments; Trophies; Players; Sporting events'],
  ['Art and Culture', 'Indian art forms; Classical and folk dances; Music; Festivals; Traditions; Cultural heritage'],
  ['Indian Literature', 'Famous Indian authors; Poets; Books; Literary works'],
  ['Monuments and Places', 'Historical monuments; Heritage sites; Tourist destinations; Famous places'],
  ['General Science', 'Physics fundamentals; Chemistry fundamentals; Biology fundamentals (up to Class 10 CBSE level)'],
  ['Life Science', 'Human body; Nutrition; Diseases; Plants; Animals; Cells; Basic biological processes'],
  ['History of India', 'Ancient, Medieval and Modern Indian History; Important dynasties; Movements; Events'],
  ['Indian Freedom Struggle', 'Revolt of 1857; Freedom movements; Important leaders; Organisations; Independence'],
  ['Geography of India and the World', 'Physical geography; Climate; Rivers; Mountains; Soils; Resources; Agriculture; World geography'],
  ['Indian Polity and Governance', 'Constitution; Fundamental rights and duties; Parliament; President; Prime Minister; Judiciary; Governance'],
  ['Science and Technology', 'Recent scientific developments; Inventions; Space programmes; Nuclear programmes; Technology'],
  ['United Nations and World Organisations', 'United Nations; Its agencies; International organisations and their functions'],
  ['Environment', 'Ecosystems; Biodiversity; Pollution; Conservation; Climate change; Environmental issues'],
  ['Basics of Computers', 'Computer fundamentals; Hardware; Software; Operating systems; Basic applications'],
  ['Common Abbreviations', 'Important national and international abbreviations and their full forms'],
  ['Transport Systems in India', 'Indian Railways; Roadways; Waterways; Airways; Major transport developments'],
  ['Indian Economy', 'Basic economic concepts; Sectors of the economy; Banking; Budget; Taxation; Economic developments'],
  ['Famous Personalities', 'Important national and international personalities and their contributions'],
  ['Government Programmes', 'Major Central Government schemes; Flagship programmes; Public welfare initiatives'],
  ['Flora and Fauna', 'Indian plants; Animals; Wildlife sanctuaries; National parks; Biodiversity'],
  ['Government and Public Sector Organisations', 'Important government bodies; Public sector undertakings and their functions'],
]);

const SUBJECTS: TnpscSubject[] = [AWARENESS.subject, MATHS.subject, REASONING.subject];

/** Wrong answers cost a third of a mark in both tests. */
const NEGATIVE = 0.33;

/** One CBT as an exam of its own: `awareness`, `maths` and `reasoning` are its question counts. */
function cbt(n: 1 | 2, counts: { awareness: number; maths: number; reasoning: number }, blurb: string): TnpscGroup {
  const total = counts.awareness + counts.maths + counts.reasoning;
  const id = `rrb-ntpc-cbt-${n}` as TnpscGroup['id'];
  const stageId = `rrb-ntpc-cbt-${n}-exam` as TnpscGroup['stages'][number]['id'];
  return {
    id,
    name: `RRB NTPC CBT-${n}`,
    short_name: `RRB NTPC CBT-${n}`,
    authority: 'Railway Recruitment Boards (RRB)',
    exam_type: `RRB NTPC CBT-${n}`,
    tagline: n === 1 ? 'Non-Technical Popular Categories — First-stage CBT' : 'Non-Technical Popular Categories — Second-stage CBT',
    description: blurb,
    accent: n === 1 ? 'from-sky-500 via-blue-500 to-indigo-600' : 'from-cyan-500 via-teal-500 to-emerald-600',
    posts: ['Station Master', 'Goods Train Manager', 'Chief Commercial cum Ticket Supervisor', 'Senior Clerk cum Typist', 'Junior Accounts Assistant cum Typist'],
    stages: [
      {
        id: stageId,
        group_id: id,
        name: n === 1 ? 'CBT 1 — First-stage Computer-Based Test' : 'CBT 2 — Second-stage Computer-Based Test',
        short_name: `CBT ${n}`,
        description: `Single objective computer-based test of ${total} questions in 90 minutes — General Awareness, Mathematics and General Intelligence & Reasoning. Common to Graduate (CEN 06/2026) and Under-Graduate (CEN 07/2026) posts.`,
        status: 'active',
        paper_type: 'objective',
        bilingual: false,
        secondary_language: null,
        pattern: {
          total_questions: total,
          total_marks: total,
          duration_minutes: 90,
          negative_marking: true,
          negative_mark_value: NEGATIVE,
          sections: [
            { name: 'General Awareness', questions: counts.awareness, marks: counts.awareness, marks_per_question: 1, negative_mark_value: NEGATIVE, syllabus_subject_ids: [AWARENESS.subject.id], units: AWARENESS.units },
            { name: 'Mathematics', questions: counts.maths, marks: counts.maths, marks_per_question: 1, negative_mark_value: NEGATIVE, syllabus_subject_ids: [MATHS.subject.id], units: MATHS.units },
            {
              name: 'General Intelligence & Reasoning',
              questions: counts.reasoning,
              marks: counts.reasoning,
              marks_per_question: 1,
              negative_mark_value: NEGATIVE,
              syllabus_subject_ids: [REASONING.subject.id],
              units: REASONING.units,
            },
          ],
        },
        subjects: SUBJECTS,
      },
    ],
  };
}

export const RRB_NTPC_GROUPS: TnpscGroup[] = [
  cbt(1, { awareness: 40, maths: 30, reasoning: 30 }, 'First-stage computer-based test of the RRB Non-Technical Popular Categories recruitment — a 100-mark screening test. One-third of a mark is deducted for each wrong answer.'),
  cbt(2, { awareness: 50, maths: 35, reasoning: 35 }, 'Second-stage computer-based test of the RRB Non-Technical Popular Categories recruitment — 120 marks, and the merit is made from its normalised marks. One-third of a mark is deducted for each wrong answer.'),
];

/** The stage each NTPC exam's papers live under. */
export const RRB_NTPC_STAGE: Record<string, string> = {
  'rrb-ntpc-cbt-1': 'rrb-ntpc-cbt-1-exam',
  'rrb-ntpc-cbt-2': 'rrb-ntpc-cbt-2-exam',
};

// ─── Wire codes ──────────────────────────────────────────────────────────────
// The backend's stage codes carry no `-exam` suffix and its units are coarser than the portal's printed areas
// (19 per stage, `n1-…` for CBT-1 and `n2-…` for CBT-2). Everything sent to it goes through these, and what comes
// back goes through `fromWireStage` / `fromWireUnit`. See RRB_NTPC_BACKEND.md.

const WIRE_UNIT: Record<string, string> = {
  'ga-current-events': 'ga-current-affairs',
  'ga-games-and-sports': 'ga-current-affairs',
  'ga-famous-personalities': 'ga-current-affairs',
  'ga-government-programmes': 'ga-current-affairs',
  'ga-art-and-culture': 'ga-art-and-culture',
  'ga-indian-literature': 'ga-art-and-culture',
  'ga-monuments-and-places': 'ga-art-and-culture',
  'ga-history-of-india': 'ga-history',
  'ga-indian-freedom-struggle': 'ga-history',
  'ga-geography-of-india-and-the-world': 'ga-geography',
  'ga-environment': 'ga-geography',
  'ga-flora-and-fauna': 'ga-geography',
  'ga-indian-polity-and-governance': 'ga-polity',
  'ga-united-nations-and-world-organisations': 'ga-polity',
  'ga-government-and-public-sector-organisations': 'ga-polity',
  'ga-indian-economy': 'ga-economy',
  'ga-transport-systems-in-india': 'ga-economy',
  'ga-general-science': 'ga-general-science',
  'ga-life-science': 'ga-general-science',
  'ga-science-and-technology': 'ga-science-and-technology',
  'ga-basics-of-computers': 'ga-computers',
  'ga-common-abbreviations': 'ga-computers',
  'maths-number-system': 'ma-number-system',
  'maths-decimals-and-fractions': 'ma-number-system',
  'maths-lcm-and-hcf': 'ma-number-system',
  'maths-ratio-and-proportion': 'ma-arithmetic',
  'maths-percentage': 'ma-arithmetic',
  'maths-profit-and-loss': 'ma-arithmetic',
  'maths-simple-and-compound-interest': 'ma-arithmetic',
  'maths-time-and-work': 'ma-time-and-work',
  'maths-time-and-distance': 'ma-time-and-work',
  'maths-elementary-algebra': 'ma-algebra',
  'maths-mensuration': 'ma-geometry-and-mensuration',
  'maths-geometry-and-trigonometry': 'ma-geometry-and-mensuration',
  'maths-elementary-statistics': 'ma-statistics',
  'reasoning-analogies': 'gi-verbal-reasoning',
  'reasoning-coding-and-decoding': 'gi-verbal-reasoning',
  'reasoning-similarities-and-differences': 'gi-verbal-reasoning',
  'reasoning-relationships': 'gi-verbal-reasoning',
  'reasoning-jumbling': 'gi-verbal-reasoning',
  'reasoning-number-series': 'gi-series-and-operations',
  'reasoning-alphabetical-series': 'gi-series-and-operations',
  'reasoning-mathematical-operations': 'gi-series-and-operations',
  'reasoning-syllogism': 'gi-logical-reasoning',
  'reasoning-venn-diagrams': 'gi-logical-reasoning',
  'reasoning-statement-and-conclusion': 'gi-logical-reasoning',
  'reasoning-statement-and-courses-of-action': 'gi-logical-reasoning',
  'reasoning-decision-making': 'gi-logical-reasoning',
  'reasoning-data-sufficiency': 'gi-logical-reasoning',
  'reasoning-analytical-reasoning': 'gi-analytical-reasoning',
  'reasoning-puzzles': 'gi-analytical-reasoning',
  'reasoning-maps-and-graph-interpretation': 'gi-analytical-reasoning',
};

const NTPC_STAGE = /^rrb-ntpc-cbt-([12])(?:-exam)?$/;

/** The stage code the backend knows: `rrb-ntpc-cbt-1-exam` → `rrb-ntpc-cbt-1`. Any other stage is unchanged. */
export const toWireStage = (stageId: string): string => stageId.replace(/^(rrb-ntpc-cbt-[12])-exam$/, '$1');

/** The backend files both CBTs under one exam: `rrb-ntpc-cbt-1` → `rrb-ntpc`. Any other group is unchanged. */
export const toWireGroup = (groupId: string): string => groupId.replace(/^rrb-ntpc-cbt-[12]$/, 'rrb-ntpc');

/** The portal's stage id for a code the backend sent. */
export const fromWireStage = (stageId: string): string => (NTPC_STAGE.test(stageId) ? `${toWireStage(stageId)}-exam` : stageId);

/** The backend unit for a portal unit of an NTPC stage; any other unit is unchanged. */
export function toWireUnit(stageId: string, unitId: string | null): string | null {
  const n = stageId.match(NTPC_STAGE)?.[1];
  if (!n || !unitId) return unitId;
  const coarse = WIRE_UNIT[unitId.replace(/^ntpc-/, '')];
  return coarse ? `n${n}-${coarse}` : unitId;
}

/** A portal unit for a backend unit — the first one that maps to it, since the backend's are coarser. */
export function fromWireUnit(unitId: string | null): string | null {
  const m = unitId?.match(/^n[12]-(.+)$/);
  if (!m) return unitId;
  const hit = Object.entries(WIRE_UNIT).find(([, v]) => v === m[1]);
  return hit ? `ntpc-${hit[0]}` : unitId;
}

/** The backend's subject code for a portal NTPC subject (`ntpc-reasoning` → `general-intelligence-and-reasoning`). */
export function toWireSubject(subjectId: string): string;
export function toWireSubject(subjectId: string | null | undefined): string | null | undefined;
export function toWireSubject(subjectId: string | null | undefined): string | null | undefined {
  if (!subjectId?.startsWith('ntpc-')) return subjectId;
  return subjectId === 'ntpc-reasoning' ? 'general-intelligence-and-reasoning' : subjectId.slice('ntpc-'.length);
}
