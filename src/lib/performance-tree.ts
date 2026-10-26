/**
 * The syllabus as a tree the student's answers hang off: Subject → Unit → Category → Sub-category.
 *
 * Built from the questions of the attempts in view. A question lands at the deepest level it names; a level it
 * does not name is simply not there (a unit with no categories is a leaf), so nothing is invented. Every node
 * counts the questions beneath it, so a parent's figures are always the sum of its children plus the questions
 * that stop at it.
 */
import { paperSection } from '@/lib/attempt-report';
import type { QuestionReviewItem } from '@/lib/userPortalApi';

export type TreeLevel = 'subject' | 'unit' | 'category' | 'subcategory';
export const LEVEL_LABEL: Record<TreeLevel, string> = {
  subject: 'Subject',
  unit: 'Unit',
  category: 'Category',
  subcategory: 'Sub-category',
};
const NEXT: Record<TreeLevel, TreeLevel | null> = {
  subject: 'unit',
  unit: 'category',
  category: 'subcategory',
  subcategory: null,
};

export interface TreeNode {
  /** Unique along the whole tree: the path of names. */
  id: string;
  name: string;
  level: TreeLevel;
  /** Every question asked beneath this node, answered or not. */
  total: number;
  attempted: number;
  correct: number;
  /** Percent of the answered ones that were right; null when none was answered. */
  accuracy: number | null;
  /** Points of accuracy gained (+) or lost (−) between the earlier and the later attempts; null when unknowable. */
  trend: number | null;
  children: TreeNode[];
}

/** One attempt's questions, oldest first. */
export interface AttemptQuestions {
  attemptId: string;
  questions: QuestionReviewItem[];
}

interface Acc {
  name: string;
  level: TreeLevel;
  id: string;
  section: number;
  /** Per attempt, in the order given: what this node saw. */
  perAttempt: Map<string, { attempted: number; correct: number; total: number }>;
  children: Map<string, Acc>;
}

const clean = (v: string | null | undefined) => (v ?? '').trim();

/**
 * The three papers every subject belongs to. A question's own `subject` is a free-text tag — "தமிழ்", "General
 * Tamil", a dozen history spellings — so the top level is the paper it sits in, and the tag becomes a unit.
 */
export const UNTAGGED_UNIT = 'Not tagged to a unit';
export const PAPER_NAME =['General Tamil', 'General Studies', 'Aptitude & Mental Ability'] as const;

function pathOf(q: QuestionReviewItem): Array<{ level: TreeLevel; name: string }> {
  const out: Array<{ level: TreeLevel; name: string }> = [];
  const section = paperSection(q);
  // The language paper carries the language the candidate sat: General English is not filed under General Tamil.
  const paper = section === 0 && /general english/i.test(`${q.subject ?? ''}`) ? 'General English' : PAPER_NAME[section];
  const unit = clean(q.unit_name);
  const category = clean(q.category);
  const sub = clean(q.subtopic_name) || clean(q.subtopic);

  out.push({ level: 'subject', name: paper });
  // A question that names no unit is still counted — under a unit of its own, never under a guessed one.
  out.push({ level: 'unit', name: unit || UNTAGGED_UNIT });
  // A category only makes sense under a real unit, and a sub-category under a category.
  if (unit && category) out.push({ level: 'category', name: category });
  if (unit && category && sub) out.push({ level: 'subcategory', name: sub });
  return out;
}

const pct = (correct: number, attempted: number) => (attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : null);

function trendOf(perAttempt: Acc['perAttempt'], order: string[]): number | null {
  const seen = order.map(id => perAttempt.get(id)).filter((x): x is NonNullable<typeof x> => !!x && x.attempted > 0);
  if (seen.length < 2) return null;
  const cut = Math.floor(seen.length / 2);
  const sum = (xs: typeof seen) => ({
    c: xs.reduce((n, x) => n + x.correct, 0),
    a: xs.reduce((n, x) => n + x.attempted, 0),
  });
  const before = sum(seen.slice(0, cut));
  const after = sum(seen.slice(cut));
  const b = pct(before.c, before.a);
  const a = pct(after.c, after.a);
  return a == null || b == null ? null : Math.round((a - b) * 10) / 10;
}

function freeze(acc: Acc, order: string[]): TreeNode {
  let total = 0;
  let attempted = 0;
  let correct = 0;
  for (const v of acc.perAttempt.values()) {
    total += v.total;
    attempted += v.attempted;
    correct += v.correct;
  }
  const children = [...acc.children.values()].map(c => freeze(c, order));
  // What the student has actually answered first, the untouched last; within each, the larger first.
  children.sort(
    (a, b) =>
      Number(a.name === UNTAGGED_UNIT) - Number(b.name === UNTAGGED_UNIT) ||
      Number(b.attempted > 0) - Number(a.attempted > 0) ||
      b.total - a.total ||
      a.name.localeCompare(b.name),
  );
  return {
    id: acc.id,
    name: acc.name,
    level: acc.level,
    total,
    attempted,
    correct,
    accuracy: pct(correct, attempted),
    trend: trendOf(acc.perAttempt, order),
    children,
  };
}

/** The tree for the given attempts (oldest first). Subjects read Tamil, General Studies, then Aptitude. */
export function buildPerformanceTree(attempts: AttemptQuestions[]): TreeNode[] {
  const order = attempts.map(a => a.attemptId);
  const roots = new Map<string, Acc>();

  for (const { attemptId, questions } of attempts) {
    for (const q of questions) {
      const path = pathOf(q);
      if (path.length === 0) continue;
      const answered = !!q.user_answer;
      let level = roots;
      let id = '';
      for (const step of path) {
        id = `${id}/${step.name}`;
        let acc = level.get(step.name);
        if (!acc) {
          acc = {
            name: step.name,
            level: step.level,
            id,
            section: step.level === 'subject' ? paperSection(q) : 1,
            perAttempt: new Map(),
            children: new Map(),
          };
          level.set(step.name, acc);
        }
        const seen = acc.perAttempt.get(attemptId) ?? { attempted: 0, correct: 0, total: 0 };
        seen.total += 1;
        if (answered) {
          seen.attempted += 1;
          if (q.is_correct) seen.correct += 1;
        }
        acc.perAttempt.set(attemptId, seen);
        level = acc.children;
      }
    }
  }

  return [...roots.values()]
    .sort((a, b) => a.section - b.section || a.name.localeCompare(b.name))
    .map(a => freeze(a, order));
}

/** Follow a path of node ids down from the roots; the siblings at the end of it, or the roots for an empty path. */
export function nodesAt(tree: TreeNode[], path: string[]): TreeNode[] {
  let level = tree;
  for (const id of path) {
    const hit = level.find(n => n.id === id);
    if (!hit) return level;
    level = hit.children;
  }
  return level;
}

export function nodeAt(tree: TreeNode[], path: string[]): TreeNode | null {
  let level = tree;
  let found: TreeNode | null = null;
  for (const id of path) {
    found = level.find(n => n.id === id) ?? null;
    if (!found) return null;
    level = found.children;
  }
  return found;
}

export const nextLevel = (l: TreeLevel) => NEXT[l];

/** Red under 40, amber to 70, green above — the thresholds the rest of the portal uses for "needs focus". */
export function toneOf(accuracy: number | null): 'none' | 'weak' | 'mid' | 'strong' {
  if (accuracy == null) return 'none';
  if (accuracy < 40) return 'weak';
  if (accuracy < 70) return 'mid';
  return 'strong';
}

/** Every real unit in the tree, whichever paper it sits in — "not tagged" is not a unit worth ranking. */
export function allUnits(tree: TreeNode[]): TreeNode[] {
  return tree.flatMap(p => p.children).filter(u => u.name !== UNTAGGED_UNIT);
}

/** The weakest nodes among `nodes` that have enough answers to mean something, worst first. */
export function weakest(nodes: TreeNode[], minAttempted = 5, limit = 5): TreeNode[] {
  return nodes
    .filter(n => n.accuracy != null && n.attempted >= minAttempted)
    .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0) || b.attempted - a.attempted)
    .slice(0, limit);
}
