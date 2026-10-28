/**
 * Changing the difficulty mix of a paper that is already made.
 *
 * Three kinds of paper are built to a mix of Simple, Medium and Complex rather than to one level — a mock, a
 * Full Unit / full-section set, and a unit or key-topic set left "Mixed" — the same three the wizard composes
 * to a blend (`EvalAssessmentConfigPanel`, `wantsBlend`). Those are the ones whose mix can be edited.
 *
 * The server owns the change: it re-draws the paper's questions to the new mix from the same pool the paper
 * was made from (its units, weights and collections), and stores the mix. See BACKEND_BLEND_EDIT.md.
 */
import { readTnpscTag, type TagBlend } from '@/lib/tnpscAdminApi';
import { asQuestionDifficulty } from '@/lib/eval-difficulty';

export type BlendKind = 'mock' | 'full-section' | 'mixed-unit' | 'mixed-topic' | 'mixed';

export const BLEND_KIND_LABEL: Record<BlendKind, string> = {
  mock: 'Mock test',
  'full-section': 'Full set',
  'mixed-unit': 'Mixed unit set',
  'mixed-topic': 'Mixed key-topic set',
  mixed: 'Mixed set',
};

/** The standard mix, and a gentler and a harder one to start from. */
export const BLEND_PRESETS: Array<{ label: string; blend: TagBlend }> = [
  { label: 'Standard', blend: { easy: 30, medium: 30, hard: 40 } },
  { label: 'Easier', blend: { easy: 50, medium: 30, hard: 20 } },
  { label: 'Balanced', blend: { easy: 34, medium: 33, hard: 33 } },
  { label: 'Harder', blend: { easy: 20, medium: 30, hard: 50 } },
];

/** Which kind of mixed paper this is, or null when it is pitched at one level and has no mix to change. */
export function blendKindOf(row: any): BlendKind | null {
  const tag = readTnpscTag(row);
  if (tag.track === 'mock') return 'mock';
  if (tag.track === 'practice') {
    if (tag.scope === 'section') return 'full-section';
    if ((tag.scope === 'unit' || tag.scope === 'topic') && !tag.level) return tag.scope === 'topic' ? 'mixed-topic' : 'mixed-unit';
    return null;
  }
  // Not placed: a paper saved as Mixed still has a mix.
  return String(row?.difficulty ?? '').toLowerCase() === 'mixed' ? 'mixed' : null;
}

const pct = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
};

/** The mix the server stored for the paper, when it stores one. */
export function storedBlend(row: any): TagBlend | null {
  const b = row?.difficulty_blend ?? row?.blend ?? null;
  if (!b || typeof b !== 'object') return null;
  const easy = pct(b.easy ?? b.simple);
  const medium = pct(b.medium);
  const hard = pct(b.hard ?? b.complex);
  return easy != null && medium != null && hard != null ? { easy, medium, hard } : null;
}

/** The mix the paper actually holds, from its questions' difficulties — null when the list does not carry them. */
export function actualMix(row: any): { blend: TagBlend; counts: TagBlend; total: number } | null {
  const qs: any[] = Array.isArray(row?.questions) ? row.questions : [];
  const counts = { easy: 0, medium: 0, hard: 0 };
  let known = 0;
  for (const q of qs) {
    const d = asQuestionDifficulty(q?.difficulty);
    if (d === 'easy' || d === 'medium' || d === 'hard') {
      counts[d] += 1;
      known += 1;
    }
  }
  if (known === 0) return null;
  return { blend: wholeBlend(counts), counts, total: known };
}

/**
 * Counts as whole percentages that add up to exactly 100 — rounding each on its own can give 99 or 101, which the
 * dialog would then refuse to save. The leftover points go to the bands with the largest remainders.
 */
export function wholeBlend(counts: TagBlend): TagBlend {
  const total = counts.easy + counts.medium + counts.hard;
  if (total <= 0) return { easy: 0, medium: 0, hard: 0 };
  const keys = ['easy', 'medium', 'hard'] as const;
  const exact = keys.map(k => (counts[k] / total) * 100);
  const floor = exact.map(Math.floor);
  let left = 100 - floor.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => [v - floor[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floor[i] += 1;
    left -= 1;
  }
  return { easy: floor[0], medium: floor[1], hard: floor[2] };
}

/** Where the mix comes from, for the dialog to say. */
export type BlendSource = 'saved' | 'questions' | 'standard';

/**
 * The mix to open the dialog on: the one the server saved; else what the paper's questions add up to; else the
 * standard 30 / 30 / 40 — and which of the three it is, so the dialog can say so.
 */
export function startingBlend(...rows: any[]): { blend: TagBlend; source: BlendSource } {
  for (const r of rows) {
    const s = storedBlend(r);
    if (s) return { blend: s, source: 'saved' };
  }
  for (const r of rows) {
    const a = actualMix(r);
    if (a) return { blend: a.blend, source: 'questions' };
  }
  return { blend: { easy: 30, medium: 30, hard: 40 }, source: 'standard' };
}

/** What is wrong with a mix, or null when it can be saved. */
export function blendProblem(b: TagBlend): string | null {
  for (const [name, v] of [['Simple', b.easy], ['Medium', b.medium], ['Complex', b.hard]] as const) {
    if (!Number.isInteger(v) || v < 0 || v > 100) return `${name} must be a whole number from 0 to 100.`;
  }
  const total = b.easy + b.medium + b.hard;
  return total === 100 ? null : `Simple, Medium and Complex must add up to 100% (they add up to ${total}% now).`;
}

export const sameBlend = (a: TagBlend | null, b: TagBlend | null) =>
  !!a && !!b && a.easy === b.easy && a.medium === b.medium && a.hard === b.hard;
