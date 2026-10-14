/**
 * What each of a unit's four buttons — Simple, Medium, Complex, Mixed — opens.
 *
 * Moved out of the Exams page so the rule that decides it can be tested: the fourth
 * button was opening the wrong paper and nothing could say so.
 */
import type { TnpscLevel } from '@/config/tnpsc';
import type { TnpscTest } from '@/lib/tnpscApi';

/** The buttons a unit offers. `all` is the Mixed paper — one set spanning every difficulty. */
export type LevelKey = TnpscLevel | 'all';

/** What a difficulty button needs to know about itself. */
export interface LevelStat {
  key: LevelKey;
  papers: TnpscTest[];
  /** The paper the button opens — the only one, or the first of several. */
  test: TnpscTest | null;
  attempts: number;
  /** True when every paper at this difficulty has been passed. */
  cleared: boolean;
  best: number | null;
}

/**
 * Every difficulty a unit offers, whether or not a paper exists behind it.
 *
 * All four are always returned. Showing only the populated ones made the row jump
 * about between units and hid the fact that a difficulty exists at all. An empty
 * difficulty renders disabled and says so, which is information; omitting it is not.
 *
 * **Mixed is the paper built to span the range, and only that.** It used to be "every
 * paper the unit holds", opening the first of them — which made sense while a unit had
 * one ungraded set and no other. Once admins build a Mixed paper next to the Simple,
 * Medium and Complex ones, "every paper" meant whichever the server listed first, and
 * pressing Mixed opened a Complex paper and counted every other paper's attempts as its
 * own. A paper with no difficulty of its own is the Mixed one; one with a difficulty is
 * that button's.
 */
export function levelStats(tests: TnpscTest[]): LevelStat[] {
  const stat = (key: LevelKey, papers: TnpscTest[]): LevelStat => ({
    key,
    papers,
    test: papers[0] ?? null,
    attempts: papers.reduce((n, t) => n + (t.attempts_used ?? 0), 0),
    cleared: papers.length > 0 && papers.every(t => t.is_completed),
    best: papers.reduce<number | null>(
      (b, t) => (t.best_percentage == null ? b : b == null ? t.best_percentage : Math.max(b, t.best_percentage)),
      null,
    ),
  });

  const graded = (['simple', 'medium', 'complex'] as TnpscLevel[]).map(lv =>
    stat(lv, tests.filter(t => t.level === lv)),
  );

  return [...graded, stat('all', tests.filter(t => !t.level))];
}
