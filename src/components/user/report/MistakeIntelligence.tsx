/**
 * "Mistake Intelligence" (mockup screen 6).
 *
 * FULLY PLACEHOLDER, by design — no semantic error-classification field exists
 * anywhere in the model. `PrimaryIssue` (ACCURACY/COVERAGE/TIME/MIXED/...) is far
 * too coarse to map onto categories like "Chronology/timeline errors" or
 * "Institution/function confusion", and there is no backend classifier for this
 * yet. The category list and counts below are illustrative content, not derived
 * from this attempt's real answers — deliberately NOT back-derived from
 * `model.summary.incorrect` either, since that would misleadingly imply real
 * per-category analysis. Replace this whole file once a real classifier exists.
 */
import { useNavigate } from 'react-router-dom';
import { XCircle, Target, AlertCircle, HelpCircle, ClipboardList, Lightbulb, ArrowLeft } from 'lucide-react';
import type { AttemptReportModel } from '@/lib/attempt-report';
import { ReportCard } from '@/components/user/report-ui';
import { cn } from '@/lib/utils';

const PATTERNS: Array<{
  icon: typeof XCircle;
  accent: string;
  title: string;
  description: string;
  count: string;
}> = [
  {
    icon: XCircle,
    accent: 'bg-rose-500',
    title: 'Concept / definition confusion',
    description: 'You are sometimes confusing similar concepts or definitions.',
    count: '6 questions',
  },
  {
    icon: Target,
    accent: 'bg-amber-500',
    title: 'Institution / function confusion',
    description: 'You are sometimes associating a function with the wrong institution.',
    count: '5 questions',
  },
  {
    icon: Target,
    accent: 'bg-amber-500',
    title: 'Chronology / timeline errors',
    description: 'Some answers show confusion in the sequence of events.',
    count: '4 questions',
  },
  {
    icon: AlertCircle,
    accent: 'bg-rose-500',
    title: 'Rule application errors',
    description: 'Difficulty applying rules or formulas to new contexts.',
    count: '3 questions',
  },
  {
    icon: HelpCircle,
    accent: 'bg-slate-400',
    title: 'Cannot determine from answer alone',
    description: 'For some questions, the reason for the error cannot be reliably inferred from the selected answer.',
    count: 'Many questions',
  },
];

export function MistakeIntelligence({ model }: { model: AttemptReportModel }) {
  const navigate = useNavigate();
  const attemptId = model.meta.attemptId;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <button
        onClick={() => navigate(`/user/report/${attemptId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Report
      </button>

      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <ClipboardList className="w-4.5 h-4.5" />
        </span>
        <div>
          <p className="text-xl font-extrabold text-gray-900 dark:text-gray-100">Mistake Intelligence</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Common patterns found in your incorrect answers</p>
        </div>
      </div>

      <ReportCard flush>
        {PATTERNS.map((p, i) => (
          <div
            key={p.title}
            className={cn(
              'flex items-center gap-3 px-4 sm:px-5 py-3.5',
              i > 0 && 'border-t border-gray-100 dark:border-gray-800',
            )}
          >
            <span className={cn('flex-shrink-0 w-8 h-8 rounded-full text-white flex items-center justify-center', p.accent)}>
              <p.icon className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-[#1e2a5a] dark:text-gray-100">{p.title}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{p.description}</p>
            </div>
            <span className="flex-shrink-0 text-[12px] font-bold text-gray-500 dark:text-gray-400 text-right whitespace-nowrap">
              {p.count}
            </span>
          </div>
        ))}
      </ReportCard>

      <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-3.5">
        <p className="inline-flex items-center gap-1.5 text-[12px] font-bold text-indigo-700 dark:text-indigo-300 mb-2">
          <Lightbulb className="w-3.5 h-3.5" /> What this means for you
        </p>
        <ul className="space-y-1 text-[11px] text-indigo-900/80 dark:text-indigo-200">
          <li>• Your errors are not random — there are clear patterns in some areas.</li>
          <li>• Focus on repeated patterns first, as they can lead to the biggest improvement.</li>
          <li>• For errors where the cause cannot be determined, we recommend a general concept review and more practice.</li>
        </ul>
      </div>
    </div>
  );
}
