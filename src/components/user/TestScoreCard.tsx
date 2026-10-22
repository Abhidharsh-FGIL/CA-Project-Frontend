/**
 * "Score by Test" — one bar per paper, for whatever selection the page is showing.
 *
 * Shared by the dashboard and the performance page. The trend curve answers "am I
 * improving over time"; this answers "which paper am I weak on", which the curve
 * can't show because it collapses every test into one running average.
 */
import { useMemo, useState } from 'react';
import { displayTitle } from '@/lib/display-title';
import { Link } from 'react-router-dom';
import { ClipboardList, Loader2 } from 'lucide-react';
import { trendCeiling } from '@/hooks/use-progress-trend';
import type { ApiAttempt } from '@/lib/userPortalApi';

/**
 * Fold attempts into one row per paper: how many times it was taken, the average
 * across those attempts, and every individual score.
 *
 * Expects `attempts` newest-first — the scores in each row inherit that order, and
 * the tooltip lists them that way.
 */
export function useTestRows(attempts: ApiAttempt[]): TestRow[] {
  return useMemo(() => {
    const byTest = new Map<string, TestRow>();
    for (const h of attempts) {
      const key = h.test_id || h.test_name || 'unknown';
      const row =
        byTest.get(key) ??
        { key, name: displayTitle(h.test_name) ?? 'Untitled test', attempts: 0, average: 0, best: 0, scores: [] };
      row.attempts += 1;
      row.scores.push({ pct: h.percentage ?? 0, date: h.start_time });
      byTest.set(key, row);
    }
    return [...byTest.values()]
      .map(row => ({
        ...row,
        average: Math.round(row.scores.reduce((sum, sc) => sum + sc.pct, 0) / row.scores.length),
        best: Math.round(Math.max(...row.scores.map(sc => sc.pct))),
      }))
      // Strongest first, matching the subject ring — so the paper needing the most
      // work is the one at the bottom, and is called out under the chart.
      .sort((x, y) => y.average - x.average);
  }, [attempts]);
}

interface TestScoreCardProps {
  /** Submitted attempts in the current selection, newest first. */
  attempts: ApiAttempt[];
  /** What the selection is, e.g. "Group 1 · mock tests" — shown under the title. */
  scopeLabel: string;
  /** Singular noun for the selected track, e.g. "Mock Test". */
  trackNoun: string;
  /** Where "Take a …" sends an aspirant with nothing to plot yet. */
  takeHref: string;
  isLoading?: boolean;
  className?: string;
}

export function TestScoreCard({
  attempts,
  scopeLabel,
  trackNoun,
  takeHref,
  isLoading,
  className,
}: TestScoreCardProps) {
  const rows = useTestRows(attempts);
  // Sorted strongest-first, the paper most worth retaking is furthest from the eye.
  const weakest = rows.length > 1 ? rows[rows.length - 1] : null;
  const noun = trackNoun.toLowerCase();

  return (
    <div
      className={
        'rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 ' + (className ?? '')
      }
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Score by Test</p>
          {rows.length > 0 && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {scopeLabel} · Average Score Across {attempts.length} Attempt{attempts.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <Link to="/user/history" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
          All attempts
        </Link>
      </div>

      {isLoading ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10">
          <span className="inline-flex w-9 h-9 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-400 items-center justify-center mb-2">
            <ClipboardList className="w-5 h-5" />
          </span>
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-[18rem] mx-auto leading-relaxed">
            No {noun} attempted in {scopeLabel} yet — each paper appears here with its average once you submit it.
          </p>
          <div className="mt-2">
            <Link to={takeHref} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              Take a {noun}
            </Link>
          </div>
        </div>
      ) : rows.length === 1 ? (
        <SingleTestSummary row={rows[0]} />
      ) : (
        <>
          <TestScoreChart rows={rows} />
          <p className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-800 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
            Hover over a bar to view the score for that test.
            {weakest && (
              <>
                {' '}Lowest-scoring test:{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-200">{weakest.name}</span> (
                {weakest.average}%).{' '}
                <Link to={takeHref} className="text-blue-600 dark:text-blue-400 hover:underline">
                  Consider retaking it
                </Link>
                .
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}

/** One paper's attempt history, as the per-test chart plots it. */
interface TestRow {
  key: string;
  name: string;
  attempts: number;
  average: number;
  best: number;
  scores: { pct: number; date: string }[];
}

/**
 * Average score per paper, one bar each.
 *
 * Each row is the paper's name over its bar, in plain HTML rather than chart axis text: names are long, and in
 * Tamil they are wider than a character count suggests, so a fixed label gutter cut them off. Here the name takes
 * the card's width and wraps to a second line before it is ever clipped. The axis ceiling follows the trend
 * curve's rule rather than a fixed 0-100 — early in preparation every bar would otherwise be a sliver.
 */
function TestScoreChart({ rows }: { rows: TestRow[] }) {
  const ceiling = trendCeiling(rows.map(r => ({ value: r.average })));
  // No scrolling box of its own: a box with a fixed height scrolled by itself inside the page, and the hover card
  // below, being part of it, made it scroll further. The first few papers show; the rest are one press away.
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows.slice(0, VISIBLE_ROWS);
  return (
    <>
    <ul className="space-y-3.5">
      {shown.map(row => (
        <li key={row.key} className="group relative">
          <div className="flex items-start justify-between gap-3">
            <p
              className="min-w-0 flex-1 text-[12px] font-semibold leading-snug text-gray-700 dark:text-gray-200 line-clamp-2 break-words"
              title={row.name}
            >
              {row.name}
            </p>
            <span className="shrink-0 text-[12px] font-bold tabular-nums text-gray-700 dark:text-gray-200">
              {row.average}%
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, Math.min(100, (row.average / ceiling) * 100))}%`, background: TEST_SERIES }}
            />
          </div>
          <p className="mt-1 text-[10px] text-gray-400">
            {row.attempts} attempt{row.attempts === 1 ? '' : 's'}
          </p>
          <ScoreHover row={row} />
        </li>
      ))}
    </ul>
    {rows.length > VISIBLE_ROWS && (
      <button
        type="button"
        onClick={() => setShowAll(v => !v)}
        className="mt-3 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
      >
        {showAll ? 'Show fewer' : `Show all ${rows.length} tests`}
      </button>
    )}
    </>
  );
}

/** Papers listed before "Show all". */
const VISIBLE_ROWS = 5;

/** A single series, so one hue and no legend — the card title names it. */
const TEST_SERIES = '#ff6c24';

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

/** Every individual score on a paper, shown over its row on hover or focus — the bar only carries the average. */
function ScoreHover({ row }: { row: TestRow }) {
  const shown = row.scores.slice(0, 6);
  return (
    <div className="pointer-events-none absolute left-0 right-0 top-full z-20 hidden max-w-[15rem] rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg group-hover:block dark:border-gray-700 dark:bg-gray-900">
      <p className="text-xs font-bold leading-snug text-gray-900 dark:text-gray-100">{row.name}</p>
      <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
        {row.attempts} attempt{row.attempts === 1 ? '' : 's'} · avg {row.average}% · best {row.best}%
      </p>
      <ul className="mt-1.5 space-y-0.5 border-t border-gray-100 pt-1.5 dark:border-gray-800">
        {shown.map((sc, i) => (
          <li key={i} className="flex items-center justify-between gap-5 text-[10px]">
            <span className="text-gray-400">{dayLabel(sc.date)}</span>
            <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-200">{Math.round(sc.pct)}%</span>
          </li>
        ))}
        {row.scores.length > shown.length && (
          <li className="pt-0.5 text-[10px] text-gray-400">+{row.scores.length - shown.length} earlier</li>
        )}
      </ul>
    </div>
  );
}
/**
 * The one-paper case, which a bar chart handles badly — a lone bar spends a whole
 * card communicating a single number, and its length has nothing to compare against.
 */
function SingleTestSummary({ row }: { row: TestRow }) {
  return (
    <div className="flex items-start gap-4 py-1">
      <div>
        <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 leading-none">{row.average}%</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 leading-tight">
          {row.attempts === 1 ? 'Your score' : `Average of ${row.attempts} attempts`}
        </p>
      </div>
      <div className="min-w-0 flex-1 border-l border-gray-100 dark:border-gray-800 pl-4">
        <p className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-snug">{row.name}</p>
        <ul className="mt-1.5 space-y-1">
          {row.scores.slice(0, 4).map((sc, i) => (
            <li key={i} className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-gray-400">{dayLabel(sc.date)}</span>
              <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">
                {Math.round(sc.pct)}%
              </span>
            </li>
          ))}
          {row.scores.length > 4 && (
            <li className="text-[10px] text-gray-400">+{row.scores.length - 4} earlier attempts</li>
          )}
        </ul>
      </div>
    </div>
  );
}
