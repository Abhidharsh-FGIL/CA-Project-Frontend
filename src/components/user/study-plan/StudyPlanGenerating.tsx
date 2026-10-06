/**
 * Shown while the server builds the plan.
 *
 * Generation is a Celery job, not a request, so this reads the job's own
 * `stage_label` rather than inventing reassuring steps of its own. A 6-month plan
 * takes under a minute; saying which part is running makes that minute legible.
 */
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReportCard } from '@/components/user/report-ui';
import type { PlanJobStatus } from '@/lib/studyPlanApi';

/**
 * The pipeline's stages, in order (§S5).
 *
 * Used only to show what is done and what is still to come — the live label
 * always comes from the server. If the backend sends a label not in this list it
 * is still displayed; the rail just will not tick a row for it.
 */
const STAGES = [
  'Reading your report',
  'Weighting the syllabus',
  'Allocating topics',
  'Scheduling revision',
  'Writing your plan',
];

function stageIndex(label: string | null): number {
  if (!label) return 0;
  const i = STAGES.findIndex(s => label.toLowerCase().startsWith(s.toLowerCase().slice(0, 12)));
  return i === -1 ? 0 : i;
}

export function StudyPlanGenerating({
  status,
  onRetry,
  onCancel,
}: {
  status: PlanJobStatus | null;
  onRetry?: () => void;
  onCancel?: () => void;
}) {
  const failed = status?.status === 'failed';
  const current = stageIndex(status?.stage_label ?? null);
  const pct = Math.max(0, Math.min(100, status?.progress ?? 0));

  if (failed) {
    return (
      <ReportCard>
        <div className="py-8 text-center">
          <span className="inline-flex w-12 h-12 rounded-full items-center justify-center bg-rose-50 dark:bg-rose-950/40 mb-3">
            <AlertTriangle className="w-6 h-6 text-rose-500" />
          </span>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Your plan could not be built
          </p>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
            {status?.error ?? 'Something went wrong on our side. Your answers were not lost.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Try again
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300"
              >
                Change my answers
              </button>
            )}
          </div>
        </div>
      </ReportCard>
    );
  }

  return (
    <ReportCard>
      <div className="py-6 text-center">
        <span className="inline-flex w-12 h-12 rounded-full items-center justify-center bg-indigo-50 dark:bg-indigo-950/40 mb-3">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </span>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Building your study plan
        </p>
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          {status?.stage_label ?? 'Starting up…'}
        </p>

        <div className="mx-auto mt-4 max-w-sm">
          <div className="h-1.5 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full rounded bg-indigo-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[10px] tabular-nums text-gray-400">{pct}%</p>
        </div>

        <ol className="mx-auto mt-4 max-w-xs space-y-1.5 text-left">
          {STAGES.map((s, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={s} className="flex items-center gap-2">
                {done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                ) : active ? (
                  <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin flex-shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-gray-200 dark:border-gray-700 flex-shrink-0" />
                )}
                <span
                  className={cn(
                    'text-[11px]',
                    done && 'text-gray-400 line-through',
                    active && 'font-semibold text-gray-800 dark:text-gray-100',
                    !done && !active && 'text-gray-400',
                  )}
                >
                  {s}
                </span>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 text-[10px] text-gray-400">
          This usually takes under a minute. You can leave this page — the plan keeps building.
        </p>
      </div>
    </ReportCard>
  );
}
