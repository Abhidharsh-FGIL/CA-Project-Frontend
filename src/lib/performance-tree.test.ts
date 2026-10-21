import { describe, expect, it } from 'vitest';
import { UNTAGGED_UNIT, allUnits, buildPerformanceTree, nodeAt, nodesAt, toneOf, weakest, type AttemptQuestions } from './performance-tree';
import type { QuestionReviewItem } from './userPortalApi';

let n = 0;
const q = (over: Partial<QuestionReviewItem>): QuestionReviewItem =>
  ({ question_id: `q${++n}`, user_answer: 'a', is_correct: true, subject: 'General Tamil', ...over }) as QuestionReviewItem;
const many = (k: number, over: Partial<QuestionReviewItem>) => Array.from({ length: k }, () => q(over));
const wrong = { is_correct: false } as Partial<QuestionReviewItem>;
const skipped = { user_answer: null, is_correct: false } as Partial<QuestionReviewItem>;
const att = (attemptId: string, questions: QuestionReviewItem[]): AttemptQuestions => ({ attemptId, questions });

const tamil = { subject: 'General Tamil', unit_name: 'இலக்கணம்' };

describe('buildPerformanceTree', () => {
  it('nests subject → unit → category → sub-category', () => {
    const tree = buildPerformanceTree([att('a', [q({ ...tamil, category: 'அணி', subtopic: 'உவமை' })])]);
    const path = tree[0].children[0].children[0].children[0];
    expect([tree[0].level, tree[0].children[0].level, tree[0].children[0].children[0].level, path.level]).toEqual([
      'subject',
      'unit',
      'category',
      'subcategory',
    ]);
    expect(path.name).toBe('உவமை');
  });

  it('stops at the deepest level a question names', () => {
    const tree = buildPerformanceTree([att('a', many(3, tamil))]);
    expect(tree[0].children[0].children).toEqual([]);
    expect(tree[0].children[0].total).toBe(3);
  });

  it('never hangs a category under a question that names no unit', () => {
    const tree = buildPerformanceTree([att('a', [q({ subject: 'General Tamil', category: 'Lonely' })])]);
    expect(tree[0].children.map(c => c.name)).toEqual([UNTAGGED_UNIT]);
    expect(tree[0].children[0].children).toEqual([]);
  });

  it('groups the many spellings of a subject under the three papers, and never turns a loose tag into a unit', () => {
    const tree = buildPerformanceTree([
      att('a', [
        q({ subject: 'தமிழ்' }),
        q({ subject: 'General Tamil', unit_name: 'இலக்கணம்' }),
        q({ subject: 'History of India' }),
        q({ subject: 'Geography' }),
        q({ subject: 'Reasoning' }),
      ]),
    ]);
    expect(tree.map(t => t.name)).toEqual(['General Tamil', 'General Studies', 'Aptitude & Mental Ability']);
    expect(tree[1].children.map(c => c.name)).toEqual([UNTAGGED_UNIT]);
    expect(tree[1].total).toBe(2);
    expect(tree[0].children.map(c => c.name).sort()).toEqual([UNTAGGED_UNIT, 'இலக்கணம்'].sort());
  });

  it('lists what was answered before what was never touched', () => {
    const tree = buildPerformanceTree([
      att('a', [...many(9, { ...tamil, unit_name: 'Untouched', ...skipped }), ...many(2, { ...tamil, unit_name: 'Done' })]),
    ]);
    expect(tree[0].children.map(c => c.name)).toEqual(['Done', 'Untouched']);
  });

  it('counts answered, correct and skipped, and a parent is the sum of what is beneath it', () => {
    const tree = buildPerformanceTree([
      att('a', [
        ...many(6, { ...tamil, category: 'X' }),
        ...many(4, { ...tamil, category: 'X', ...wrong }),
        ...many(5, { ...tamil, category: 'Y', ...skipped }),
        ...many(10, { ...tamil, category: 'Y' }),
      ]),
    ]);
    const unit = tree[0].children[0];
    expect(unit).toMatchObject({ total: 25, attempted: 20, correct: 16, accuracy: 80 });
    const [x, y] = [unit.children.find(c => c.name === 'X')!, unit.children.find(c => c.name === 'Y')!];
    expect(x).toMatchObject({ total: 10, attempted: 10, correct: 6, accuracy: 60 });
    expect(y).toMatchObject({ total: 15, attempted: 10, accuracy: 100 });
    expect(x.total + y.total).toBe(unit.total);
    expect(tree[0]).toMatchObject({ total: 25, accuracy: 80 });
  });

  it('has no accuracy for something never answered, not 0%', () => {
    const tree = buildPerformanceTree([att('a', many(4, { ...tamil, ...skipped }))]);
    expect(tree[0].accuracy).toBeNull();
    expect(tree[0].attempted).toBe(0);
  });

  it('reads Tamil, then General Studies, then Aptitude', () => {
    const tree = buildPerformanceTree([
      att('a', [q({ subject: 'Aptitude & Mental Ability' }), q({ subject: 'Indian Polity' }), q({ subject: 'General Tamil' })]),
    ]);
    expect(tree.map(t => t.name)).toEqual(['General Tamil', 'General Studies', 'Aptitude & Mental Ability']);
  });

  it('measures the trend as later attempts against earlier ones', () => {
    const tree = buildPerformanceTree([
      att('a1', [...many(2, tamil), ...many(8, { ...tamil, ...wrong })]), // 20%
      att('a2', [...many(5, tamil), ...many(5, { ...tamil, ...wrong })]), // 50%
      att('a3', [...many(8, tamil), ...many(2, { ...tamil, ...wrong })]), // 80%
      att('a4', [...many(8, tamil), ...many(2, { ...tamil, ...wrong })]), // 80%
    ]);
    // earlier two: 7/20 = 35%; later two: 16/20 = 80%
    expect(tree[0].trend).toBe(45);
  });

  it('has no trend from a single attempt', () => {
    expect(buildPerformanceTree([att('a', many(5, tamil))])[0].trend).toBeNull();
  });
});

describe('walking the tree', () => {
  const tree = buildPerformanceTree([att('a', [q({ ...tamil, category: 'அணி' }), q({ subject: 'Polity' })])]);
  const unitId = tree[0].children[0].id;

  it('returns the roots for an empty path and the children for a path', () => {
    expect(nodesAt(tree, []).map(t => t.name)).toEqual(['General Tamil', 'General Studies']);
    expect(nodesAt(tree, [tree[0].id]).map(t => t.name)).toEqual(['இலக்கணம்']);
    expect(nodeAt(tree, [tree[0].id, unitId])?.name).toBe('இலக்கணம்');
  });

  it('falls back safely on a path that no longer exists', () => {
    expect(nodesAt(tree, ['/gone']).map(t => t.name)).toEqual(['General Tamil', 'General Studies']);
    expect(nodeAt(tree, ['/gone'])).toBeNull();
  });
});

describe('tone and the weakest list', () => {
  it('bands accuracy', () => {
    expect([toneOf(null), toneOf(10), toneOf(40), toneOf(69.9), toneOf(70)]).toEqual(['none', 'weak', 'mid', 'mid', 'strong']);
  });

  it('lists the weakest first and ignores a thin sample', () => {
    const tree = buildPerformanceTree([
      att('a', [
        ...many(10, { unit_name: 'A' }),
        ...many(10, { unit_name: 'B', ...wrong }),
        ...many(2, { unit_name: 'C', ...wrong }),
        ...many(10, { unit_name: 'D' }).map((x, i) => (i < 5 ? { ...x, is_correct: false } : x)),
      ]),
    ]);
    expect(weakest(allUnits(tree)).map(t => t.name)).toEqual(['B', 'D', 'A']);
  });
});
