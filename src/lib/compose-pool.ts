/**
 * Building a fixed paper out of a pool, across groups and across difficulties.
 *
 * A full mock has two independent requirements. It has to follow the exam's *split* —
 * 100 Tamil, 75 General Studies, 25 Aptitude, and within those the published count of
 * each unit — and it has to follow the *difficulty blend*, 20 / 30 / 50. The blend used
 * to be applied to the whole pool at once, which answers only the second: it takes the
 * first N of each difficulty in the order the bank returns them (newest upload first), so
 * a mock came out as 172 Aptitude and 28 Tamil with no General Studies at all.
 *
 * So the two are applied in the right order. Questions are bucketed by group, each group
 * is given its share of the paper, and the blend is applied *inside* each group.
 *
 * A group the bank cannot fill is reported, and its shortfall goes to the other groups
 * of the same cluster (a Tamil unit's gap to the other Tamil units) before any other, so
 * the section totals the exam publishes are the last thing to give.
 */
import { pickByBlend } from '@/lib/difficulty-blend';
import { distributeQuestions } from '@/lib/distribution-utils';

export interface ComposeGroup {
  key: string;
  label: string;
  /** What this group rolls up into — a unit's section — so a gap is made up from its own kind first. */
  cluster?: string;
}

export interface ComposeOptions {
  /** Apply the 20 / 30 / 50 blend inside each group. Off for a paper that is not a whole one. */
  blend: boolean;
  /** The mix to apply, in percent; the standard 30 / 30 / 40 when absent. */
  blendWeights?: Record<'easy' | 'medium' | 'hard', number>;
  /** Injectable for tests; defaults to `Math.random`. */
  random?: () => number;
}

export interface GroupPlan {
  key: string;
  label: string;
  /** What the weights ask of this group. */
  wanted: number;
  /** What the pool holds for it. */
  available: number;
}

export interface Composition<T> {
  picked: T[];
  /** How many ended up in each group, spill included. */
  byGroup: Record<string, number>;
  plan: GroupPlan[];
  /** Groups whose pool is smaller than their share. */
  short: GroupPlan[];
  /** Questions that could not be placed anywhere because every pool ran dry. */
  unfilled: number;
}

/** Percentages that total 100, whatever was passed — missing or zero weights share evenly. */
function normalise(keys: string[], weights: Record<string, number>): Record<string, number> {
  const raw = keys.map(k => Math.max(0, Number(weights[k]) || 0));
  const sum = raw.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  keys.forEach((k, i) => {
    out[k] = sum > 0 ? (raw[i] / sum) * 100 : 100 / keys.length;
  });
  return out;
}

/** Each question goes to one group — the earliest of its groups — and to none if it has none. */
function bucket<T>(
  pool: T[],
  groups: ComposeGroup[],
  classify: (q: T) => string[],
): Record<string, T[]> {
  const order = new Map(groups.map((g, i) => [g.key, i]));
  const out: Record<string, T[]> = {};
  for (const g of groups) out[g.key] = [];
  for (const q of pool) {
    let best: string | null = null;
    for (const k of classify(q)) {
      if (!order.has(k)) continue;
      if (best === null || order.get(k)! < order.get(best)!) best = k;
    }
    if (best !== null) out[best].push(q);
  }
  return out;
}

function planOf<T>(
  pools: Record<string, T[]>,
  groups: ComposeGroup[],
  weights: Record<string, number>,
  total: number,
): GroupPlan[] {
  const keys = groups.map(g => g.key);
  const wanted = distributeQuestions(total, normalise(keys, weights));
  return groups.map(g => ({
    key: g.key,
    label: g.label,
    wanted: wanted[g.key] ?? 0,
    available: pools[g.key].length,
  }));
}

/**
 * What a paper of `total` would ask of each group and what the pool holds for it, without
 * choosing anything — cheap enough to show while the weights are being edited.
 */
export function planGroups<T>(
  pool: T[],
  groups: ComposeGroup[],
  classify: (q: T) => string[],
  weights: Record<string, number>,
  total: number,
): GroupPlan[] {
  if (groups.length === 0) return [];
  return planOf(bucket(pool, groups, classify), groups, weights, total);
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function composeByGroups<T extends { difficulty?: string | null }>(
  pool: T[],
  groups: ComposeGroup[],
  classify: (q: T) => string[],
  weights: Record<string, number>,
  total: number,
  { blend, blendWeights, random = Math.random }: ComposeOptions,
): Composition<T> {
  if (groups.length === 0 || total <= 0) {
    return { picked: [], byGroup: {}, plan: [], short: [], unfilled: Math.max(0, total) };
  }

  // Shuffled first, so the paper is a sample of what the bank holds and not whatever it
  // happened to return first — two mocks built from one pool should not be the same mock.
  const pools = bucket(pool, groups, classify);
  for (const g of groups) pools[g.key] = shuffled(pools[g.key], random);

  const plan = planOf(pools, groups, weights, total);

  const take = (from: T[], n: number): T[] =>
    n <= 0 ? [] : blend ? pickByBlend(from, Math.min(n, from.length), blendWeights).picked : from.slice(0, n);

  const chosen: Record<string, T[]> = {};
  const left: Record<string, T[]> = {};
  for (const p of plan) {
    const got = take(pools[p.key], Math.min(p.wanted, p.available));
    chosen[p.key] = got;
    const used = new Set<T>(got);
    left[p.key] = pools[p.key].filter(q => !used.has(q));
  }

  // Make up what a short group could not supply: from its own cluster first, then anyone.
  const clusterOf = new Map(groups.map(g => [g.key, g.cluster ?? g.key]));
  for (const p of plan) {
    let missing = p.wanted - chosen[p.key].length;
    if (missing <= 0) continue;

    for (const sameCluster of [true, false]) {
      while (missing > 0) {
        const donors = plan.filter(
          d =>
            d.key !== p.key &&
            left[d.key].length > 0 &&
            (clusterOf.get(d.key) === clusterOf.get(p.key)) === sameCluster,
        );
        if (donors.length === 0) break;
        // One round shares the gap between donors rather than draining the first.
        const each = Math.max(1, Math.ceil(missing / donors.length));
        for (const d of donors) {
          if (missing <= 0) break;
          const n = Math.min(each, missing, left[d.key].length);
          const got = take(left[d.key], n);
          const used = new Set<T>(got);
          left[d.key] = left[d.key].filter(q => !used.has(q));
          // They are the donor's questions, so they are counted under the donor: the
          // composition reports where questions really came from, not who was short.
          chosen[d.key].push(...got);
          missing -= got.length;
        }
      }
      if (missing <= 0) break;
    }
  }

  const picked = groups.flatMap(g => chosen[g.key]);
  const byGroup: Record<string, number> = {};
  for (const g of groups) byGroup[g.key] = chosen[g.key].length;

  return {
    picked,
    byGroup,
    plan,
    short: plan.filter(p => p.available < p.wanted),
    unfilled: Math.max(0, total - picked.length),
  };
}
