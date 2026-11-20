/**
 * What counts as passing a MyGovExams test, and what to aim for.
 *
 * These are MyGovExams *learning benchmarks*, not TNPSC's own cut-offs: they say whether a student has a
 * paper under control, not whether they would qualify for the real examination. Easier papers are held to a
 * higher mark and harder ones to a lower, since the same score means more on a Complex paper; the full-length
 * mock carries a demanding benchmark of its own so preparation aims above the minimum.
 *
 *   Simple practice   70 %   aim 85 %
 *   Medium practice   60 %   aim 75 %
 *   Complex practice  50 %   aim 65 %
 *   Mixed practice    60 %   aim 75 %
 *   Key-topic set     60 %   aim 75 %
 *   Section Full Set  60 %   aim 75 %
 *   Full-length mock  60 %   aim 75 %   (180 / 300 and 225 / 300 on the Group 4 paper)
 *
 * These are the defaults. An admin can set them for the whole product, for one exam ("RRB NTPC CBT-1 Graduate: unit
 * papers 60 %, mock 70 %, key topics 75 %"), and for a single assessment; the narrowest setting wins — see `passMarkFor`.
 */
import { stageForTitle, TNPSC_GROUPS } from '@/config/tnpsc';

export interface PassMark {
  /** The score, in percent, that counts as a pass. */
  pass: number;
  /** The score, in percent, to aim for. */
  target: number;
}

export type PassMarkKey = 'simple' | 'medium' | 'complex' | 'mixed' | 'keytopic' | 'section' | 'mock';

/** Every kind of paper a pass mark can be set for, in the order an admin sees them. */
export const PASS_MARK_KEYS: PassMarkKey[] = ['simple', 'medium', 'complex', 'mixed', 'keytopic', 'section', 'mock'];

export const PASS_MARK_LABEL: Record<PassMarkKey, string> = {
  simple: 'Unit · Simple',
  medium: 'Unit · Medium',
  complex: 'Unit · Complex',
  mixed: 'Unit · Mixed',
  keytopic: 'Key topic',
  section: 'Section Full Set',
  mock: 'Full-length mock',
};

/** The four difficulty buttons of a unit paper — what "unit-wise" sets together. */
export const UNIT_PASS_KEYS: PassMarkKey[] = ['simple', 'medium', 'complex', 'mixed'];

/** The bundled benchmarks — what is used until the server's arrive, and when it sends none. */
export const PASS_MARKS: Record<PassMarkKey, PassMark> = {
  simple: { pass: 70, target: 85 },
  medium: { pass: 60, target: 75 },
  complex: { pass: 50, target: 65 },
  mixed: { pass: 60, target: 75 },
  keytopic: { pass: 60, target: 75 },
  section: { pass: 60, target: 75 },
  mock: { pass: 60, target: 75 },
};

export type PassMarkTable = Record<PassMarkKey, PassMark>;

/** What an exam sets for itself: only the kinds of paper it names — the rest follow the product-wide table. */
export type ExamPassMarks = Partial<PassMarkTable>;

let current: PassMarkTable = PASS_MARKS;
let byExam: Record<string, ExamPassMarks> = {};

/** The benchmarks in force: the server's once they have arrived, otherwise the bundled ones. */
export const currentPassMarks = (): PassMarkTable => current;
export const applyPassMarks = (table: PassMarkTable): void => {
  current = table;
};
/** The product-wide table and each exam's own settings, as the server sent them. */
export const applyPassMarkSettings = (settings: PassMarkSettings): void => {
  if (settings.global) current = settings.global;
  byExam = settings.exams;
};
export const currentExamPassMarks = (): Record<string, ExamPassMarks> => byExam;
export const resetPassMarks = (): void => {
  current = PASS_MARKS;
  byExam = {};
};

/** The pass mark of a full-length mock, in percent — what a mock level is cleared at. The exam's own, when it sets one. */
export const mockPassPercentage = (examKey?: string | null): number => (examKey && byExam[examKey]?.mock) ? byExam[examKey].mock!.pass : current.mock.pass;

/** Any spelling of a difficulty -> the key it is judged under. A paper that names none is a mixed one. */
export function levelKey(level: unknown): Exclude<PassMarkKey, 'mock'> {
  const v = typeof level === 'string' ? level.trim().toLowerCase() : '';
  if (v === 'simple' || v === 'easy') return 'simple';
  if (v === 'medium' || v === 'moderate') return 'medium';
  if (v === 'complex' || v === 'hard' || v === 'difficult') return 'complex';
  return 'mixed';
}

/** The exam (the group id — "rrb-ntpc-cbt-1-grad", "group-4") a paper's title belongs to, or null. */
export function examKeyForTitle(title: string | null | undefined): string | null {
  const stage = stageForTitle(title);
  if (!stage) return null;
  return TNPSC_GROUPS.find(g => g.stages.some(st => st.id === stage.id))?.id ?? null;
}

export type PaperScope = 'unit' | 'keytopic' | 'section';

/**
 * What a practice paper covers, as its title says: "<exam> — <section> · Full Set" is a section's Full Set;
 * "<exam> — <unit>: <topic> · <level>" is a key topic; anything else is a unit paper. Null when the title says nothing.
 */
export function paperScopeFromTitle(title: string | null | undefined): PaperScope | null {
  const t = (title ?? '').trim();
  const dash = t.indexOf(' — ');
  if (dash < 0) return null;
  const rest = t.slice(dash + 3);
  const dot = rest.lastIndexOf(' · ');
  if (dot < 0) return null;
  if (rest.slice(dot + 3).trim().toLowerCase() === 'full set') return 'section';
  return rest.slice(0, dot).includes(':') ? 'keytopic' : 'unit';
}

/**
 * The benchmark for a paper. The narrowest setting wins:
 *
 *   1. the assessment's own pass mark (`override`), when its admin set one;
 *   2. its exam's setting for this kind of paper — a mock, a key topic, a section's Full Set, or a unit paper by
 *      difficulty — where the admin set one for that exam;
 *   3. the product-wide table, then the bundled defaults.
 *
 * The exam comes from `examKey`, or is read off the paper's `title`. A key topic or Full Set is told apart by `scope`,
 * or by the title. An override with no target of its own keeps the setting's aim, lifted to the pass mark if it is under.
 */
export function passMarkFor(paper: {
  kind: 'mock' | 'practice';
  level?: unknown;
  title?: string | null;
  scope?: PaperScope | null;
  examKey?: string | null;
  override?: { pass?: unknown; target?: unknown } | null;
}): PassMark {
  const key: PassMarkKey =
    paper.kind === 'mock'
      ? 'mock'
      : (() => {
          const scope = paper.scope ?? paperScopeFromTitle(paper.title);
          return scope === 'keytopic' ? 'keytopic' : scope === 'section' ? 'section' : levelKey(paper.level);
        })();
  const examKey = paper.examKey ?? (paper.title ? examKeyForTitle(paper.title) : null);
  const base = (examKey ? byExam[examKey]?.[key] : undefined) ?? current[key];

  const pass = pctOf(paper.override?.pass);
  if (pass == null) return base;
  const target = pctOf(paper.override?.target) ?? Math.max(base.target, pass);
  return { pass, target: Math.max(target, pass) };
}

/** The same benchmark as marks out of a paper's total, rounded up to a whole mark: 60 % of 300 is 180. */
export function passMarks(mark: PassMark, maxMarks: number | null | undefined): { pass: number; target: number } | null {
  if (maxMarks == null || !(maxMarks > 0)) return null;
  return { pass: Math.ceil((mark.pass / 100) * maxMarks), target: Math.ceil((mark.target / 100) * maxMarks) };
}

export type PassStanding = 'target' | 'pass' | 'close' | 'below';

/** How a score reads against the benchmark, in the words shown to the candidate. */
export type Performance = 'needs-improvement' | 'passed' | 'strong' | 'excellent';

export const PERFORMANCE_LABEL: Record<Performance, string> = {
  'needs-improvement': 'Needs Improvement',
  passed: 'Passed',
  strong: 'Strong Performance',
  excellent: 'Excellent',
};

/**
 * Below the pass mark -> Needs Improvement; from it to below the target -> Passed; the target to below 90% ->
 * Strong Performance; 90% and above -> Excellent. `null` when nothing was scored.
 */
export function performanceOf(percent: number | null | undefined, mark: PassMark): Performance | null {
  if (percent == null) return null;
  if (percent < mark.pass) return 'needs-improvement';
  if (percent >= 90 && percent >= mark.target) return 'excellent';
  if (percent >= mark.target) return 'strong';
  return 'passed';
}

/** Where a score sits against the benchmark. "Close" is within 15 points under the pass mark. */
export function standingOf(percent: number | null | undefined, mark: PassMark): PassStanding | null {
  if (percent == null) return null;
  if (percent >= mark.target) return 'target';
  if (percent >= mark.pass) return 'pass';
  if (percent >= mark.pass - 15) return 'close';
  return 'below';
}

/**
 * A paper's difficulty as its title states it ("Name - Medium"); undefined when the title names none.
 * "Mixed" is only read as a trailing tag, since the word turns up in ordinary titles.
 */
export function levelFromTitle(title: string | null | undefined): string | undefined {
  const m = /\b(simple|medium|complex)\b|[·—-]\s*mixed\s*$/i.exec(title ?? '');
  if (!m) return undefined;
  return m[1] ? m[1].toLowerCase() : 'mixed';
}

// --- What the server sends --------------------------------------------------------------------------------------

const ALIASES: Record<string, PassMarkKey> = {
  simple: 'simple', easy: 'simple',
  medium: 'medium', moderate: 'medium',
  complex: 'complex', hard: 'complex', difficult: 'complex',
  mixed: 'mixed',
  keytopic: 'keytopic', key_topic: 'keytopic', key_topics: 'keytopic', topic: 'keytopic',
  section: 'section', full_set: 'section', fullset: 'section', section_full_set: 'section',
  mock: 'mock', full_mock: 'mock', full_length_mock: 'mock', fulllengthmock: 'mock', exam: 'mock',
};

const pctOf = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};

/**
 * Reads the benchmarks off the server's response, over the bundled ones. Tolerant of the spelling: a table keyed by
 * `simple | medium | complex | mixed | mock` (or `easy`, `hard`, `full_mock`), bare or under `pass_marks`, each entry
 * `{ pass, target }` (also `pass_percentage` / `target_percentage`) or just the pass mark as a number.
 * An entry that is missing or not a sensible percentage keeps its bundled value; null when nothing usable came.
 */
export function parsePassMarks(raw: unknown): PassMarkTable | null {
  const root = (raw ?? null) as Record<string, unknown> | null;
  if (!root || typeof root !== 'object') return null;
  const table = (root.pass_marks ?? root.passMarks ?? root.marks ?? root.default ?? root.global ?? root) as Record<string, unknown>;
  const read = readTable(table);
  return read ? { ...PASS_MARKS, ...read } : null;
}

/** The kinds of paper a table sets, each a sensible { pass, target }; null when it sets none. */
function readTable(table: unknown): ExamPassMarks | null {
  if (!table || typeof table !== 'object' || Array.isArray(table)) return null;
  const next: ExamPassMarks = {};
  let found = 0;
  for (const [name, value] of Object.entries(table as Record<string, unknown>)) {
    const key = ALIASES[name.trim().toLowerCase().replace(/[\s-]+/g, '_')];
    if (!key) continue;
    const entry = (value ?? null) as Record<string, unknown> | number | string | null;
    const passRaw = entry && typeof entry === 'object' ? (entry.pass ?? entry.pass_percentage ?? entry.pass_mark) : entry;
    const targetRaw = entry && typeof entry === 'object' ? (entry.target ?? entry.target_percentage ?? entry.aim) : undefined;
    const pass = pctOf(passRaw);
    if (pass == null) continue;
    // A target below the pass mark is a mistake in the setting; fall back to the bundled aim, lifted above the pass mark.
    let target = pctOf(targetRaw) ?? PASS_MARKS[key].target;
    if (target < pass) target = Math.min(100, Math.max(PASS_MARKS[key].target, pass));
    next[key] = { pass, target };
    found += 1;
  }
  return found > 0 ? next : null;
}

/** The product-wide table, and what each exam sets for itself — what the server's pass-marks endpoint carries. */
export interface PassMarkSettings {
  global: PassMarkTable | null;
  /** By exam (the group id); only the kinds of paper the exam names. */
  exams: Record<string, ExamPassMarks>;
}

/**
 * Reads the whole response: the product-wide table (bare, or under `pass_marks` / `default`) and, under `exams`
 * (or `stages`), a table for each exam keyed by its group id. An exam's table names only what it overrides.
 */
export function parsePassMarkSettings(raw: unknown): PassMarkSettings {
  const root = (raw ?? null) as Record<string, unknown> | null;
  const exams: Record<string, ExamPassMarks> = {};
  const listed = root && typeof root === 'object' ? (root.exams ?? root.stages ?? root.exam_pass_marks) : null;
  if (listed && typeof listed === 'object' && !Array.isArray(listed)) {
    for (const [examKey, table] of Object.entries(listed as Record<string, unknown>)) {
      const read = readTable((table as Record<string, unknown> | null)?.pass_marks ?? table);
      if (read) exams[examKey] = read;
    }
  }
  return { global: parsePassMarks(raw), exams };
}
