/**
 * "Progress Journey" (mockup screen 10) — the whole /user/progress page content.
 *
 * Real content as of item 9 of the report redesign: every number here comes
 * straight from `GET /user/progress/` (progress_report.py) — `score`,
 * `max_score`, `accuracy_percentage`, `correct`, `attempted` are each their own
 * unambiguous field, never something this component derives or guesses at
 * (the earlier version built its own numbers from a per-attempt detail
 * fan-out, which is what produced results like a lone "1.5" on the chart with
 * no way to tell which figure it actually was).
 *
 * "Baseline established" and the trend chart are mutually exclusive real
 * states, not two pieces of the same screen: with fewer than two comparable
 * attempts there is nothing to plot a trend from, so the page says so
 * plainly instead of drawing a chart with one dot on it.
 */
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Camera, Sparkles, Bot, Sprout, ChevronDown } from 'lucide-react';
import type { ProgressAttemptSummary, ProgressReportApiResponse } from '@/lib/userPortalApi';
import { ReportCard } from '@/components/user/report-ui';

type Metric = 'score' | 'accuracy' | 'attemptRate';

const METRIC_LABEL: Record<Metric, string> = {
  score: 'Overall Score',
  accuracy: 'Accuracy',
  attemptRate: 'Attempt Rate',
};

function attemptRate(a: ProgressAttemptSummary): number | null {
  const total = a.attempted + a.unattempted;
  return total > 0 ? Math.round((a.attempted / total) * 100 * 10) / 10 : null;
}

function metricValue(a: ProgressAttemptSummary, metric: Metric): number | null {
  if (metric === 'score') return a.score;
  if (metric === 'accuracy') return a.accuracy_percentage;
  return attemptRate(a);
}

const METRIC_NOUN: Record<Metric, string> = { score: 'score', accuracy: 'accuracy', attemptRate: 'attempt rate' };

/** Below this per-attempt slope, the series reads as flat rather than
 * trending — small enough to still catch a real, if gentle, direction. */
const FLAT_SLOPE_THRESHOLD = 0.5;

function formatMetric(value: number, metric: Metric): string {
  return metric === 'score' ? `${value}` : `${value}%`;
}

function attemptDateSuffix(a: ProgressAttemptSummary): string {
  if (!a.date) return '';
  const d = new Date(a.date);
  return isNaN(d.getTime()) ? '' : ` (${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })})`;
}

/** Least-squares slope, per attempt — the same statistic `progress_report.py`
 * already reports as `trend.percentage_slope`/`accuracy_slope`, computed here
 * per-metric so it tracks whichever one is currently selected. */
function linearSlope(values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  const denominator = values.reduce((sum, _v, i) => sum + (i - meanX) ** 2, 0);
  if (!denominator) return null;
  const numerator = values.reduce((sum, v, i) => sum + (i - meanX) * (v - meanY), 0);
  return numerator / denominator;
}

/**
 * A real, evidence-grounded read of the currently-selected metric's trend —
 * not just the first-vs-latest delta, which one noisy endpoint (a strong
 * opening attempt, or a rough latest one) can make say something the rest of
 * the series doesn't support. `index` is each attempt's position in the FULL
 * attempts array (matching the chart's "Attempt N" x-axis labels), not its
 * position after filtering to comparable ones — otherwise a named attempt
 * number here could point at the wrong dot on the chart.
 *
 * Three grounded facts, each traceable to a plotted point:
 *  - the overall direction, from a least-squares slope across every
 *    comparable point, not just the two endpoints;
 *  - the strongest/weakest attempt in the series, when that extreme sits in
 *    the middle rather than just restating the first/last point already
 *    named above — this is what a volatile, non-monotonic series (a real
 *    mid-series spike or crash) actually shows and a two-point comparison
 *    hides entirely;
 *  - the single most recent move, since that's usually what a student
 *    checking this page today wants first.
 * No cause (fatigue, a harder paper, etc.) is ever inferred — only what the
 * numbers themselves say.
 */
function progressTakeaway(attempts: ProgressAttemptSummary[], metric: Metric): string {
  const points = attempts
    .map((attempt, index) => ({ attempt, index, value: metricValue(attempt, metric) }))
    .filter(
      (p): p is { attempt: ProgressAttemptSummary; index: number; value: number } =>
        p.attempt.comparability.comparable && p.value != null,
    );
  if (points.length < 2) return 'Not enough scored, comparable attempts yet to describe a trend.';

  const noun = METRIC_NOUN[metric];
  const first = points[0];
  const last = points[points.length - 1];
  const outOf = metric === 'score' && last.attempt.max_score != null ? ` (out of ${last.attempt.max_score})` : '';
  const slope = linearSlope(points.map(p => p.value));

  const sentences: string[] = [];

  if (slope == null || Math.abs(slope) < FLAT_SLOPE_THRESHOLD) {
    sentences.push(
      `Your ${noun} has stayed roughly flat across your last ${points.length} comparable attempts, running from ${formatMetric(first.value, metric)} to ${formatMetric(last.value, metric)}${outOf}.`,
    );
  } else {
    const direction = slope > 0 ? 'trending up' : 'trending down';
    const rate = formatMetric(Math.round(Math.abs(slope) * 10) / 10, metric);
    sentences.push(
      `Your ${noun} is ${direction} across your last ${points.length} comparable attempts — averaging about ${rate} per attempt — from ${formatMetric(first.value, metric)} to ${formatMetric(last.value, metric)}${outOf}.`,
    );
  }

  let best = points[0];
  let worst = points[0];
  for (const p of points) {
    if (p.value > best.value) best = p;
    if (p.value < worst.value) worst = p;
  }
  const named = new Set([first.index, last.index]);
  if (!named.has(best.index)) {
    sentences.push(`Its strongest point was Attempt ${best.index + 1}${attemptDateSuffix(best.attempt)} at ${formatMetric(best.value, metric)}.`);
    named.add(best.index);
  }
  if (!named.has(worst.index) && worst.value !== best.value) {
    sentences.push(`Its weakest was Attempt ${worst.index + 1}${attemptDateSuffix(worst.attempt)} at ${formatMetric(worst.value, metric)}.`);
  }

  if (points.length >= 3) {
    const prev = points[points.length - 2];
    const recentDelta = Math.round((last.value - prev.value) * 10) / 10;
    if (recentDelta !== 0) {
      sentences.push(
        `Most recently it moved ${recentDelta > 0 ? 'up' : 'down'} ${formatMetric(Math.abs(recentDelta), metric)} between your last two attempts.`,
      );
    }
  }

  return sentences.join(' ');
}

export function ProgressJourney({ data, examName }: { data: ProgressReportApiResponse; examName?: string | null }) {
  const [metric, setMetric] = useState<Metric>('score');

  const isBaseline = data.trend.attempts_in_trend < 2;

  const chartData = data.attempts.map((a, i) => ({
    label: `Attempt ${i + 1}`,
    date: a.date ? new Date(a.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '',
    value: metricValue(a, metric),
  }));

  const latest = data.attempts[data.attempts.length - 1];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <ReportCard>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Camera className="w-4.5 h-4.5" />
            </span>
            <div>
              <p className="text-lg font-extrabold text-[#1e2a5a] dark:text-gray-100">Your Progress Journey</p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                {isBaseline ? 'A recap of this attempt, until there is a trend to compare it against.' : 'A recap plan to help you improve.'}
              </p>
            </div>
          </div>
          {!isBaseline && (
            <div className="relative">
              <select
                value={metric}
                onChange={e => setMetric(e.target.value as Metric)}
                className="appearance-none text-[12px] font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-3 pr-7 py-1.5 text-gray-700 dark:text-gray-200"
              >
                {(Object.keys(METRIC_LABEL) as Metric[]).map(m => (
                  <option key={m} value={m}>
                    {METRIC_LABEL[m]}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
        </div>

        {isBaseline ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 p-3 text-center">
              <p className="text-lg font-extrabold text-indigo-700 dark:text-indigo-300">
                {latest?.score ?? '—'}
                {latest?.max_score != null && <span className="text-[12px] font-semibold text-indigo-400">/{latest.max_score}</span>}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Score</p>
            </div>
            <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 p-3 text-center">
              <p className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
                {latest?.accuracy_percentage != null ? `${latest.accuracy_percentage}%` : '—'}
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Accuracy</p>
            </div>
            <div className="rounded-xl bg-violet-50/70 dark:bg-violet-950/30 p-3 text-center">
              <p className="text-lg font-extrabold text-violet-700 dark:text-violet-300">
                {latest?.correct ?? '—'}
                <span className="text-[12px] font-semibold text-violet-400">/{latest?.attempted ?? '—'}</span>
              </p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Correct</p>
            </div>
          </div>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis
                  domain={metric === 'score' ? [0, 'auto'] : [0, 100]}
                  tick={{ fontSize: 10 }}
                  width={36}
                  tickFormatter={v => (metric === 'score' ? `${v}` : `${v}%`)}
                />
                <Tooltip
                  formatter={(v: number) => (metric === 'score' ? v : `${v}%`)}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 4, fill: '#6366f1' }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ReportCard>

      {isBaseline ? (
        <ReportCard className="flex items-start gap-3">
          <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <Bot className="w-4.5 h-4.5" />
          </span>
          <div>
            <p className="text-[13px] font-bold text-[#1e2a5a] dark:text-gray-100">Baseline established</p>
            <p className="text-[12px] text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
              This score is your baseline{examName ? ` for ${examName}` : ''}. Complete another comparable assessment
              to unlock improvement analysis.
            </p>
          </div>
        </ReportCard>
      ) : (
        <ReportCard className="flex items-start gap-3">
          <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5" />
          </span>
          <div>
            <p className="text-[13px] font-bold text-[#1e2a5a] dark:text-gray-100">AI Insight</p>
            <p className="text-[12px] text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">{progressTakeaway(data.attempts, metric)}</p>
          </div>
        </ReportCard>
      )}

      <div className="flex items-center justify-center gap-2 pt-2">
        <p className="text-sm italic text-gray-500 dark:text-gray-400">Small steps. Big progress.</p>
        <Sprout className="w-4 h-4 text-emerald-500" />
      </div>
    </div>
  );
}
