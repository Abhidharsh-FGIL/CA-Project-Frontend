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
 *   Full-length mock  60 %   aim 75 %   (180 / 300 and 225 / 300 on the Group 4 paper)
 */
export interface PassMark {
  /** The score, in percent, that counts as a pass. */
  pass: number;
  /** The score, in percent, to aim for. */
  target: number;
}

export type PassMarkKey = 'simple' | 'medium' | 'complex' | 'mixed' | 'mock';

/** The bundled benchmarks — what is used until the server's arrive, and when it sends none. */
export const PASS_MARKS: Record<PassMarkKey, PassMark> = {
  simple: { pass: 70, target: 85 },
  medium: { pass: 60, target: 75 },
  complex: { pass: 50, target: 65 },
  mixed: { pass: 60, target: 75 },
  mock: { pass: 60, target: 75 },
};

export type PassMarkTable = Record<PassMarkKey, PassMark>;

let current: PassMarkTable = PASS_MARKS;

/** The benchmarks in force: the server's once they have arrived, otherwise the bundled ones. */
export const currentPassMarks = (): PassMarkTable => current;
export const applyPassMarks = (table: PassMarkTable): void => {
  current = table;
};
export const resetPassMarks = (): void => {
  current = PASS_MARKS;
};

/** The pass mark of a full-length mock, in percent — what a mock level is cleared at. */
export const mockPassPercentage = (): number => current.mock.pass;

/** Any spelling of a difficulty -> the key it is judged under. A paper that names none is a mixed one. */
export function levelKey(level: unknown): Exclude<PassMarkKey, 'mock'> {
  const v = typeof level === 'string' ? level.trim().toLowerCase() : '';
  if (v === 'simple' || v === 'easy') return 'simple';
  if (v === 'medium' || v === 'moderate') return 'medium';
  if (v === 'complex' || v === 'hard' || v === 'difficult') return 'complex';
  return 'mixed';
}

/** The benchmark for a paper: a mock has its own; a practice paper goes by its difficulty. */
export function passMarkFor(paper: { kind: 'mock' | 'practice'; level?: unknown }): PassMark {
  return paper.kind === 'mock' ? current.mock : current[levelKey(paper.level)];
}

/** The same benchmark as marks out of a paper's total, rounded up to a whole mark: 60 % of 300 is 180. */
export function passMarks(mark: PassMark, maxMarks: number | null | undefined): { pass: number; target: number } | null {
  if (maxMarks == null || !(maxMarks > 0)) return null;
  return { pass: Math.ceil((mark.pass / 100) * maxMarks), target: Math.ceil((mark.target / 100) * maxMarks) };
}

export type PassStanding = 'target' | 'pass' | 'close' | 'below';

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
  const table = (root.pass_marks ?? root.passMarks ?? root.marks ?? root) as Record<string, unknown>;
  if (!table || typeof table !== 'object') return null;

  const next: PassMarkTable = { ...PASS_MARKS };
  let found = 0;
  for (const [name, value] of Object.entries(table)) {
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