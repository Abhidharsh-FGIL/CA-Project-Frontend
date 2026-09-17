/**
 * "Score by Test" — one bar per paper, for whatever selection the page is showing.
 *
 * Shared by the dashboard and the performance page. The trend curve answers "am I
 * improving over time"; this answers "which paper am I weak on", which the curve
 * can't show because it collapses every test into one running average.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
        { key, name: h.test_name ?? 'Untitled test', attempts: 0, average: 0, best: 0, scores: [] };
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
              {scopeLabel} · average across {attempts.length} attempt{attempts.length === 1 ? '' : 's'} on{' '}
              {rows.length} paper{rows.length === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <Link to="/user/history" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
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
            <Link to={takeHref} className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
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
            Hover a bar for every score on that paper.
            {weakest && (
              <>
                {' '}Lowest average:{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-200">{weakest.name}</span> (
                {weakest.average}%) —{' '}
                <Link to={takeHref} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  retake it
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
 * A single series, so one hue and no legend — the card title names it. Validated
 * against both the light and dark chart surfaces (dataviz six checks, all pass).
 */
const TEST_SERIES = '#6366f1';
/** Row pitch and bar thickness: under the 24px cap, with the leftover left as air. */
const TEST_ROW_PITCH = 38;
const TEST_BAR_SIZE = 18;

/** Longest paper name the axis gutter fits before it starts eating the plot. */
function shortName(name: string, max = 20) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

/**
 * Average score per paper, one bar each.
 *
 * Horizontal because paper names are long and would collide as column labels. The
 * axis ceiling follows the trend curve's rule rather than a fixed 0–100 — early in
 * preparation every bar would otherwise be an invisible sliver on the baseline.
 */
function TestScoreChart({ rows }: { rows: TestRow[] }) {
  const ceiling = trendCeiling(rows.map(r => ({ value: r.average })));
  return (
    <div className="max-h-[19rem] overflow-y-auto scrollbar-thin -ml-1 pr-1">
      <div style={{ height: rows.length * TEST_ROW_PITCH + 26 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 46, bottom: 0, left: 0 }}>
            <XAxis
              type="number"
              domain={[0, ceiling]}
              tickFormatter={(v: number) => `${v}%`}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              height={22}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={124}
              tickLine={false}
              axisLine={false}
              interval={0}
              tick={<TestTick rows={rows} />}
            />
            <Tooltip cursor={{ fill: 'rgba(99,102,241,0.06)' }} content={<TestTooltip />} />
            <Bar dataKey="average" fill={TEST_SERIES} radius={[0, 4, 4, 0]} maxBarSize={TEST_BAR_SIZE}>
              {/* Value at the tip — the axis alone can't be read across a long gutter. */}
              <LabelList
                dataKey="average"
                position="right"
                offset={8}
                className="fill-gray-600 dark:fill-gray-300"
                fontSize={10}
                fontWeight={700}
                formatter={(v: any) => `${v}%`}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
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

/** Paper name over its attempt count, so "attempts" is readable without hovering. */
function TestTick({ x, y, payload, rows }: any) {
  const row: TestRow | undefined = rows[payload?.index];
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-8} y={-1} textAnchor="end" fontSize={11} fontWeight={600} className="fill-gray-700 dark:fill-gray-200">
        {shortName(String(payload?.value ?? ''))}
      </text>
      <text x={-8} y={11} textAnchor="end" fontSize={9} className="fill-gray-400">
        {row?.attempts ?? 0} attempt{row?.attempts === 1 ? '' : 's'}
      </text>
    </g>
  );
}

/** Every individual score on the hovered paper — the bar only carries the average. */
function TestTooltip({ active, payload }: any) {
  const row: TestRow | undefined = payload?.[0]?.payload;
  if (!active || !row) return null;
  const shown = row.scores.slice(0, 6);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-lg max-w-[15rem]">
      <p className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-snug">{row.name}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
        {row.attempts} attempt{row.attempts === 1 ? '' : 's'} · avg {row.average}% · best {row.best}%
      </p>
      <ul className="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
        {shown.map((sc, i) => (
          <li key={i} className="flex items-center justify-between gap-5 text-[10px]">
            <span className="text-gray-400">{dayLabel(sc.date)}</span>
            <span className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{Math.round(sc.pct)}%</span>
          </li>
        ))}
        {row.scores.length > shown.length && (
          <li className="text-[10px] text-gray-400 pt-0.5">+{row.scores.length - shown.length} earlier</li>
        )}
      </ul>
    </div>
  );
}
