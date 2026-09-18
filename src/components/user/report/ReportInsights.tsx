/**
 * "AI Detailed Insights" (mockup screen 2), reached from the Overview's "View
 * Detailed Insights" button.
 *
 * The three sub-fields per card — Evidence / AI Analysis / What you can do — map
 * directly onto `Insight.evidence` / `.implication` / `.action`. Those last two were
 * already computed by `buildInsights` in attempt-report.ts but never rendered
 * anywhere in the app (confirmed by grep earlier this session) — this screen is
 * what finally shows them, no new generation involved.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lightbulb } from 'lucide-react';
import type { AttemptReportModel, Confidence, Insight } from '@/lib/attempt-report';
import { insightConfidence } from '@/lib/attempt-report';
import { ReportCard, ACCENT, type Accent } from '@/components/user/report-ui';
import { cn } from '@/lib/utils';

const RANK_ACCENT: Accent[] = ['rose', 'amber', 'emerald', 'indigo'];

const CONFIDENCE_ACCENT: Record<Confidence, Accent> = {
  HIGH: 'indigo',
  MEDIUM: 'amber',
  LOW: 'slate',
};

/** One card's headline, phrased for its bucket — the underlying data (evidence/
 * implication/action) is real either way; only this short title is new copy. */
function cardTitle(insight: Insight, bucket: 'gaps' | 'coverageGaps' | 'quickWins' | 'strengths'): string {
  switch (bucket) {
    case 'gaps':
      return `Conceptual gaps in ${insight.title}`;
    case 'coverageGaps':
      return `${insight.title} needs a first look`;
    case 'strengths':
      return `${insight.title} is a relative strength`;
    case 'quickWins':
    default:
      return insight.title;
  }
}

/** Up to 4 insights, one per bucket where possible, backfilling from a bucket that
 * has more than one item if fewer than 4 buckets have anything to show. */
function pickInsights(
  model: AttemptReportModel,
): Array<{ insight: Insight; bucket: 'gaps' | 'coverageGaps' | 'quickWins' | 'strengths' }> {
  const buckets: Array<{ items: Insight[]; key: 'gaps' | 'coverageGaps' | 'quickWins' | 'strengths' }> = [
    { items: model.gaps, key: 'gaps' },
    { items: model.coverageGaps, key: 'coverageGaps' },
    { items: model.quickWins, key: 'quickWins' },
    { items: model.strengths, key: 'strengths' },
  ];
  const picked = buckets.filter(b => b.items.length > 0).map(b => ({ insight: b.items[0], bucket: b.key }));
  for (const b of buckets) {
    if (picked.length >= 4) break;
    if (b.items.length > 1) picked.push({ insight: b.items[1], bucket: b.key });
  }
  return picked.slice(0, 4);
}

function InsightField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex-shrink-0 w-28 text-[10px] font-bold uppercase tracking-wide text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg px-2 py-1.5 text-center">
        {label}
      </span>
      <p className="flex-1 text-[12px] leading-relaxed text-gray-700 dark:text-gray-200 pt-1.5">{value}</p>
    </div>
  );
}

export function ReportInsights({ model }: { model: AttemptReportModel }) {
  const navigate = useNavigate();
  const attemptId = model.meta.attemptId;
  const insights = pickInsights(model);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <button
        onClick={() => navigate(`/user/report/${attemptId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Report
      </button>

      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <Lightbulb className="w-4.5 h-4.5" />
        </span>
        <div>
          <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100">AI Detailed Insights</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Here's a deeper look at what your answers reveal.</p>
        </div>
      </div>

      {insights.length === 0 ? (
        <ReportCard>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">
            Not enough attempted questions yet for a detailed insight.
          </p>
        </ReportCard>
      ) : (
        insights.map(({ insight, bucket }, i) => {
          const confidence = insightConfidence(insight, model);
          return (
            <ReportCard key={`${bucket}-${insight.subjectId ?? i}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={cn(
                      'flex-shrink-0 w-7 h-7 rounded-full text-white text-[12px] font-bold flex items-center justify-center',
                    )}
                    style={{ background: ACCENT[RANK_ACCENT[i % RANK_ACCENT.length]].hex }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-[14px] font-bold text-[#1e2a5a] dark:text-gray-100 truncate">
                    {cardTitle(insight, bucket)}
                  </p>
                </div>
                <span
                  className={cn(
                    'flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full',
                    ACCENT[CONFIDENCE_ACCENT[confidence]].chip,
                  )}
                >
                  {confidence === 'HIGH' ? 'High' : confidence === 'MEDIUM' ? 'Medium' : 'Low'} Confidence
                </span>
              </div>
              <div className="space-y-2.5">
                <InsightField label="Evidence" value={insight.evidence} />
                <InsightField label="AI Analysis" value={insight.implication} />
                <InsightField label="What you can do" value={insight.action} />
              </div>
            </ReportCard>
          );
        })
      )}

      <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-3.5 flex items-start gap-2.5">
        <Lightbulb className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
          These insights are based on your actual answers. Use them to guide your preparation.
        </p>
      </div>
    </div>
  );
}
