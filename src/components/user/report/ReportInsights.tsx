/**
 * "Detailed Insights" (mockup screen 2), reached from the Overview's "View
 * Detailed Insights" button.
 *
 * Real content as of the AI Detailed Insights prompt redesign: each card is one
 * of `analysis.topic_diagnoses` — a specific, evidence-grounded diagnosis for one
 * priority candidate (never a generic "revise concepts" summary — see
 * llm_topic_diagnosis.py). "AI Analysis" is relabelled "What this suggests" per
 * that redesign. Falls back to the older deterministic Insight cards
 * (evidence/implication/action) while topic_diagnoses isn't ready yet.
 *
 * The confidence badge ("High/Medium/Low Confidence") that used to sit on each
 * card is deliberately gone: it's an internal generation/validation signal
 * (still computed, still checked server-side — see llm_topic_diagnosis.py's
 * confidence-vs-evidence-band rule), not something a student reading their own
 * report has a use for. `card.confidence` is kept on the data model since
 * nothing downstream needs it removed, just not rendered.
 */
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lightbulb } from 'lucide-react';
import type { AttemptReportModel, Confidence, Insight } from '@/lib/attempt-report';
import { insightConfidence } from '@/lib/attempt-report';
import { ReportCard, ACCENT, type Accent } from '@/components/user/report-ui';
import type { AttemptAnalysisResponse, AttemptAnalysisTopicDiagnosis } from '@/lib/userPortalApi';

const RANK_ACCENT: Accent[] = ['rose', 'amber', 'emerald', 'indigo'];

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

interface InsightCard {
  key: string;
  title: string;
  confidence: Confidence;
  fields: Array<{ label: string; value: string }>;
}

const TOPIC_CONFIDENCE: Record<AttemptAnalysisTopicDiagnosis['confidence'], Confidence> = {
  low: 'LOW',
  moderate: 'MEDIUM',
  high: 'HIGH',
};

function topicDiagnosisCards(diagnoses: AttemptAnalysisTopicDiagnosis[]): InsightCard[] {
  return diagnoses.map(d => ({
    key: d.scope_id,
    title: d.finding,
    confidence: TOPIC_CONFIDENCE[d.confidence],
    fields: [
      { label: 'Evidence', value: d.evidence },
      { label: 'What this suggests', value: d.interpretation },
      { label: 'What you can do', value: d.next_action },
      { label: 'Mastery Check', value: d.mastery_check },
    ],
  }));
}

function deterministicCards(model: AttemptReportModel): InsightCard[] {
  return pickInsights(model).map(({ insight, bucket }, i) => ({
    key: `${bucket}-${insight.subjectId ?? i}`,
    title: cardTitle(insight, bucket),
    confidence: insightConfidence(insight, model),
    fields: [
      { label: 'Evidence', value: insight.evidence },
      { label: 'AI Analysis', value: insight.implication },
      { label: 'What you can do', value: insight.action },
    ],
  }));
}

export function ReportInsights({
  model,
  analysis,
}: {
  model: AttemptReportModel;
  /** The new backend pipeline's per-priority diagnoses, when ready — see the module doc comment above. */
  analysis?: AttemptAnalysisResponse | null;
}) {
  const navigate = useNavigate();
  const attemptId = model.meta.attemptId;
  const insights =
    analysis?.topic_diagnoses && analysis.topic_diagnoses.length > 0
      ? topicDiagnosisCards(analysis.topic_diagnoses)
      : deterministicCards(model);

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
          <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Detailed Insights</p>
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
        insights.map((card, i) => (
          <ReportCard key={card.key}>
            <div className="flex items-center gap-2.5 min-w-0 mb-4">
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full text-white text-[12px] font-bold flex items-center justify-center"
                style={{ background: ACCENT[RANK_ACCENT[i % RANK_ACCENT.length]].hex }}
              >
                {i + 1}
              </span>
              <p className="text-[14px] font-bold text-[#1e2a5a] dark:text-gray-100 truncate">{card.title}</p>
            </div>
            <div className="space-y-2.5">
              {card.fields.map(f => (
                <InsightField key={f.label} label={f.label} value={f.value} />
              ))}
            </div>
          </ReportCard>
        ))
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
