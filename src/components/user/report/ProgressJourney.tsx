/**
 * "Progress Journey" (mockup screen 10) — the whole /user/progress page content
 * for the redesign, replacing `ProgressReportView`'s much larger dashboard
 * (executive summary, radar, gap evolution, behaviour analysis, its own weekly
 * plan, etc. — none of which appear in the mockup) with just what screen 10
 * shows. `ProgressReportView.tsx` itself is untouched: it's still used by
 * `ReportBody.tsx`'s inline Progress tab on the admin-shared report, so nothing
 * about it can change here — this is a new, separate, smaller view for this
 * route only.
 *
 * "AI Insight" and "First attempt?" are mutually exclusive real states, not two
 * pieces of the same screen — one attempt gets the friendly first-attempt card,
 * two or more get the real trend narrative. Showing both for the same data would
 * just repeat the same "not enough data yet" point twice.
 */
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Camera, Sparkles, Bot, Sprout, ChevronDown } from 'lucide-react';
import type { ProgressReportModel } from '@/lib/progress-report';
import { ReportCard } from '@/components/user/report-ui';

type Metric = 'score' | 'accuracy' | 'attemptRate';

const METRIC_LABEL: Record<Metric, string> = {
  score: 'Overall Score',
  accuracy: 'Accuracy',
  attemptRate: 'Attempt Rate',
};

function metricValue(a: ProgressReportModel['attempts'][number], metric: Metric): number | null {
  if (metric === 'score') return a.score;
  if (metric === 'accuracy') return a.accuracyPct;
  return a.attemptRatePct;
}

export function ProgressJourney({ model }: { model: ProgressReportModel }) {
  const [metric, setMetric] = useState<Metric>('score');

  const data = model.attempts.map((a, i) => ({
    label: `Attempt ${i + 1}`,
    date: new Date(a.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
    value: metricValue(a, metric),
  }));

  const isFirstAttempt = model.window.attempts === 1;

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
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">A recap plan to help you improve.</p>
            </div>
          </div>
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
        </div>

        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
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
      </ReportCard>

      {isFirstAttempt ? (
        <ReportCard className="flex items-start gap-3">
          <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
            <Bot className="w-4.5 h-4.5" />
          </span>
          <div>
            <p className="text-[13px] font-bold text-[#1e2a5a] dark:text-gray-100">First attempt?</p>
            <p className="text-[12px] text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">
              This is your first recorded attempt. This score will be your baseline. Complete more assessments to
              see your progress trend here.
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
            <p className="text-[12px] text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed">{model.journeyTakeaway}</p>
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
