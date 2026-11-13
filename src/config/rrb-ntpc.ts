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
 * The units, topics and their names are the backend's (`RRB_NTPC_BACKEND.md`, and the 52-unit map the
 * backend sent (`rrb_ntpc_52_units_map_2026-11-07.xlsx`)): 52 units over three subjects, `n1-…` for CBT-1 and `n2-…` for CBT-2. Names are held in English, Tamil and Hindi;
 * `ntpcLabel` gives the one the aspirant chose, and the English where a translation has not been supplied.
 *
 * The types come from `tnpsc.ts`, which imports this file for the data; the import here is type-only so the two do not
 * load each other.
 */
import { hindiName } from '@/lib/hindi-names';
import { NTPC_SUBJECTS, NTPC_UNITS, type NtpcSubjectData, type NtpcUnitData } from './rrb-ntpc-data';
import type { TnpscGroup, TnpscSubject, TnpscSyllabusUnit, TnpscTopic } from './tnpsc';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII'];

/** A subject with its units, the order the sheet gives them in. */
interface S extends NtpcSubjectData {
  units: NtpcUnitData[];
}

/** General Awareness, Mathematics, then Reasoning — the order the papers print them in. */
const ORDER = ['general-awareness', 'mathematics', 'general-intelligence-and-reasoning'];

const SYLLABUS: S[] = [...NTPC_SUBJECTS].sort((x, y) => ORDER.indexOf(x.code) - ORDER.indexOf(y.code)).map(sub => ({ ...sub, units: NTPC_UNITS.filter(u => u.subject === sub.code) }));

// ─── Names in the language the aspirant chose ────────────────────────────────

/** The languages the portal offers an NTPC aspirant. */
export type NtpcNameLanguage = 'tamil' | 'english' | 'hindi';

interface Names {
  ta?: string;
  hi?: string;
}

/** English name → its Tamil and Hindi: every subject, unit and topic of the sheet. */
const NAMES = new Map<string, Names>();
for (const sub of SYLLABUS) {
  NAMES.set(sub.en, { ta: sub.ta, hi: sub.hi });
  for (const u of sub.units) {
    NAMES.set(u.en, { ta: u.ta, hi: u.hi });
    for (const [en, ta, hi] of u.topics) if (!NAMES.has(en)) NAMES.set(en, { ta, hi });
  }
}
// The pattern and the subject list spell the third subject with "and", the sheet with "&".
NAMES.set('General Intelligence and Reasoning', NAMES.get('General Intelligence & Reasoning') ?? {});

/**
 * A subject, unit or topic name in the chosen language: its translation where there is one, its English where there
 * is not (or when English was chosen, or none). Any name this file does not know is returned as it is.
 */
export function ntpcLabel(name: string, language: NtpcNameLanguage | string | null | undefined): string {
  if (!name || language === 'english' || !language) return name;
  const hit = NAMES.get(name);
  // Hindi the server sent wins over the sheet this build was made from.
  if (language === 'hindi') return hindiName(name) || hit?.hi || name;
  return (language === 'tamil' ? hit?.ta : undefined) || name;
}

// ─── The catalog ─────────────────────────────────────────────────────────────

/**
 * A topic shown under a shorter name than the sheet's. Only the name on screen changes: the id is still made from the
 * sheet's wording, and its Tamil and Hindi stay registered under it, so papers and reports that carry it still match.
 */
const TOPIC_DISPLAY: Record<string, string> = {
  // The unit is "Current Events" and this is its only topic: the long form only repeated it.
  'Current Events of National and International Importance': 'Current Events',
};

const topicsOf = (u: NtpcUnitData): TnpscTopic[] => u.topics.map(([en]) => ({ id: slug(en), name: TOPIC_DISPLAY[en] ?? en }));

/**
 * One subject's units for one exam: ids carry the exam (`n1-` CBT-1 Under-Graduate, `ng-` CBT-1 Graduate, `n2-` CBT-2 —
 * the backend's own), and the counts are that test's.
 */
function build(n: 1 | 2, s: S, prefix: string): { subject: TnpscSubject; units: TnpscSyllabusUnit[] } {
  const units: TnpscSyllabusUnit[] = s.units.map((u, i) => ({
    id: `${prefix}-${u.key}`,
    label: ROMAN[i + 1],
    name: u.en,
    name_ta: u.ta,
    subject_ids: [s.id],
    questions: u.q[n - 1],
    topics: topicsOf(u),
  }));
  // The subject's own topics are its units, which is how a paper tagged with a unit's name finds its place.
  const subject: TnpscSubject = { id: s.id, name: s.en === 'General Intelligence & Reasoning' ? 'General Intelligence and Reasoning' : s.en, name_ta: s.ta, topics: s.units.map(u => ({ id: slug(u.en), name: u.en })) };
  return { subject, units };
}

/** Wrong answers cost a third of a mark in both tests. */
const NEGATIVE = 0.33;

/**
 * How one CBT is offered. CBT-1 is two exams, one per level — Under-Graduate keeps the id CBT-1 always had
 * (`rrb-ntpc-cbt-1`), so every saved choice, link and attempt still finds it; Graduate is `rrb-ntpc-cbt-1-grad`.
 * CBT-2 is one exam for both levels.
 */
interface CbtVariant {
  id: string;
  /** What the aspirant reads: "RRB NTPC CBT-1 (UG)". Paper titles keep `exam_type` ("RRB NTPC CBT-1") — see tnpscAdminApi. */
  name: string;
  tagline: string;
  accent: string;
  /** Whose posts it is for, in the stage's description. */
  posts: string;
  /** Beside the stage's name in its title — "CBT 1 (UG) — First-stage Computer-Based Test". */
  level?: string;
  /** What its unit ids start with, as the backend has them: `n1`, `ng`, `n2`. */
  unitPrefix: string;
}

/** One CBT as an exam of its own: `awareness`, `maths` and `reasoning` are its question counts. */
function cbt(n: 1 | 2, counts: { awareness: number; maths: number; reasoning: number }, blurb: string, variant: CbtVariant): TnpscGroup {
  const total = counts.awareness + counts.maths + counts.reasoning;
  const id = variant.id as TnpscGroup['id'];
  const stageId = `${variant.id}-exam` as TnpscGroup['stages'][number]['id'];
  const [awareness, maths, reasoning] = SYLLABUS.map(s => build(n, s, variant.unitPrefix));
  const section = (name: string, questions: number, b: ReturnType<typeof build>) => ({
    name,
    questions,
    marks: questions,
    marks_per_question: 1,
    negative_mark_value: NEGATIVE,
    syllabus_subject_ids: [b.subject.id],
    units: b.units,
  });
  return {
    id,
    name: variant.name,
    short_name: variant.name,
    authority: 'Railway Recruitment Boards (RRB)',
    exam_type: `RRB NTPC CBT-${n}`,
    tagline: variant.tagline,
    description: blurb,
    accent: variant.accent,
    posts: ['Station Master', 'Goods Train Manager', 'Chief Commercial cum Ticket Supervisor', 'Senior Clerk cum Typist', 'Junior Accounts Assistant cum Typist'],
    stages: [
      {
        id: stageId,
        group_id: id,
        name: `CBT ${n}${variant.level ? ` (${variant.level})` : ''} — ${n === 1 ? 'First' : 'Second'}-stage Computer-Based Test`,
        short_name: `CBT ${n}`,
        description: `Single objective computer-based test of ${total} questions in 90 minutes — General Awareness, Mathematics and General Intelligence & Reasoning. ${variant.posts}`,
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
            section('General Awareness', counts.awareness, awareness),
            section('Mathematics', counts.maths, maths),
            section('General Intelligence & Reasoning', counts.reasoning, reasoning),
          ],
        },
        subjects: [awareness.subject, maths.subject, reasoning.subject],
      },
    ],
  };
}

const CBT1_COUNTS = { awareness: 40, maths: 30, reasoning: 30 };
const CBT1_BLURB = (posts: string) =>
  `First-stage computer-based test of the RRB Non-Technical Popular Categories recruitment for ${posts} — a 100-mark screening test.`;

export const RRB_NTPC_GROUPS: TnpscGroup[] = [
  cbt(1, CBT1_COUNTS, CBT1_BLURB('Under-Graduate posts'), {
    id: 'rrb-ntpc-cbt-1',
    name: 'RRB NTPC CBT-1 (UG)',
    tagline: 'Non-Technical Popular Categories — First-stage CBT · Under-Graduate posts',
    accent: 'from-sky-500 via-blue-500 to-indigo-600',
    posts: 'For Under-Graduate (12th pass) posts.',
    level: 'UG',
    unitPrefix: 'n1',
  }),
  cbt(1, CBT1_COUNTS, CBT1_BLURB('Graduate posts'), {
    id: 'rrb-ntpc-cbt-1-grad',
    name: 'RRB NTPC CBT-1 (Graduate)',
    tagline: 'Non-Technical Popular Categories — First-stage CBT · Graduate posts',
    accent: 'from-indigo-500 via-violet-500 to-purple-600',
    posts: 'For Graduate posts.',
    level: 'Graduate',
    unitPrefix: 'ng',
  }),
  cbt(2, { awareness: 50, maths: 35, reasoning: 35 }, 'Second-stage computer-based test of the RRB Non-Technical Popular Categories recruitment — 120 marks, and the merit is made from its normalised marks.', {
    id: 'rrb-ntpc-cbt-2',
    name: 'RRB NTPC CBT-2',
    tagline: 'Non-Technical Popular Categories — Second-stage CBT',
    accent: 'from-cyan-500 via-teal-500 to-emerald-600',
    posts: 'Common to Graduate and Under-Graduate posts.',
    unitPrefix: 'n2',
  }),
];

/** The stage each NTPC exam's papers live under. */
export const RRB_NTPC_STAGE: Record<string, string> = {
  'rrb-ntpc-cbt-1': 'rrb-ntpc-cbt-1-exam',
  'rrb-ntpc-cbt-1-grad': 'rrb-ntpc-cbt-1-grad-exam',
  'rrb-ntpc-cbt-2': 'rrb-ntpc-cbt-2-exam',
};

// ─── Wire codes ──────────────────────────────────────────────────────────────
// The backend's group is `rrb-ntpc` for both tests and its stage codes carry no `-exam` suffix; its subjects are
// `general-awareness`, `mathematics` and `general-intelligence-and-reasoning`. Units are the same on both sides (`n1-…`, `n2-…`).
// Everything sent goes through these, and what comes back goes through `fromWire*`. See RRB_NTPC_BACKEND.md.
//
// CBT-1 Graduate has its own stage on the backend, `rrb-ntpc-cbt-1-grad`, with its own units (`ng-…`) — see
// BACKEND_NTPC_LEVELS.md. Papers are counted by the stage they are filed under, not by their title.
export const CBT1_GRADUATE_WIRE_STAGE = 'rrb-ntpc-cbt-1-grad';

const NTPC_STAGE = /^rrb-ntpc-cbt-(?:1-grad|[12])(?:-exam)?$/;

/** The stage code the backend knows: `rrb-ntpc-cbt-1-exam` → `rrb-ntpc-cbt-1`; Graduate's, see above. Any other stage is unchanged. */
export const toWireStage = (stageId: string): string =>
  /^rrb-ntpc-cbt-1-grad(?:-exam)?$/.test(stageId) ? CBT1_GRADUATE_WIRE_STAGE : stageId.replace(/^(rrb-ntpc-cbt-[12])-exam$/, '$1');

/** The backend files every CBT under one exam: `rrb-ntpc-cbt-1`, `rrb-ntpc-cbt-1-grad` → `rrb-ntpc`. Any other group is unchanged. */
export const toWireGroup = (groupId: string): string => groupId.replace(/^rrb-ntpc-cbt-(?:1-grad|[12])$/, 'rrb-ntpc');

/** The portal's stage id for a code the backend sent. CBT-1's own code is the Under-Graduate exam's — `fromWireRow` places a Graduate paper. */
export const fromWireStage = (stageId: string): string =>
  NTPC_STAGE.test(stageId) ? `${stageId.replace(/-exam$/, '')}-exam` : stageId;

/** Units are the same on both sides; kept so every caller converts the same way. */
export const toWireUnit = (_stageId: string, unitId: string | null): string | null => unitId;
export const fromWireUnit = (unitId: string | null): string | null => unitId;

/** The backend's subject code for a portal NTPC subject (`ntpc-reasoning` → `general-intelligence-and-reasoning`). */
export function toWireSubject(subjectId: string): string;
export function toWireSubject(subjectId: string | null | undefined): string | null | undefined;
export function toWireSubject(subjectId: string | null | undefined): string | null | undefined {
  const hit = SYLLABUS.find(s => s.id === subjectId);
  return hit ? hit.code : subjectId;
}

/** The portal's subject id for a backend NTPC subject (`general-awareness` → `ntpc-general-awareness`). */
export function fromWireSubject<T extends string | null | undefined>(subjectId: T): T {
  const hit = SYLLABUS.find(s => s.code === subjectId);
  return (hit ? hit.id : subjectId) as T;
}

/**
 * A row the backend filed under an NTPC stage, put back in the portal's codes. Any other row is returned as it is.
 * The stage says which exam it is — `rrb-ntpc-cbt-1` Under-Graduate, `rrb-ntpc-cbt-1-grad` Graduate — whatever the
 * paper's title says (the backend counts a paper by its stage).
 */
export function fromWireRow<T extends Record<string, any>>(row: T): T {
  const stage = row?.tnpsc_stage_id ?? row?.stage_id;
  if (typeof stage !== 'string' || !NTPC_STAGE.test(stage)) return row;
  const out: Record<string, any> = { ...row };
  const swap = (key: string, f: (v: string) => string | null) => {
    if (typeof out[key] === 'string') out[key] = f(out[key]);
  };
  swap('stage_id', fromWireStage);
  swap('tnpsc_stage_id', fromWireStage);
  swap('subject_id', fromWireSubject);
  swap('tnpsc_subject_id', fromWireSubject);
  // Every CBT sits under one backend exam, so the portal's group is the one its stage belongs to.
  const group = fromWireStage(stage).replace(/-exam$/, '');
  if (out.group_id === 'rrb-ntpc') out.group_id = group;
  if (out.tnpsc_group_id === 'rrb-ntpc') out.tnpsc_group_id = group;
  return out as T;
}
