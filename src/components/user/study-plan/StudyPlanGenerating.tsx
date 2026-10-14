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
          <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100">
            Your plan could not be built
          </p>
          <p className="mt-1 text-[14px] text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
            {status?.error ?? 'Something went wrong on our side. Your answers were not lost.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-xl bg-brand-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-brand-700"
              >
                Try again
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-2 text-[13px] font-semibold text-gray-600 dark:text-gray-300"
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
    <div className="relative overflow-hidden rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-gradient-to-b from-blue-50/70 to-white dark:from-blue-950/20 dark:to-gray-900">
      {/* Soft shapes at the edges, so the page isn't a card floating on nothing. */}
      <div className="pointer-events-none absolute -left-16 top-10 h-44 w-44 rounded-full bg-blue-100/60 blur-2xl dark:bg-blue-900/20" />
      <div className="pointer-events-none absolute -right-14 top-1/3 h-52 w-52 rounded-full bg-sky-100/60 blur-2xl dark:bg-sky-900/20" />
      <div className="pointer-events-none absolute -bottom-16 right-1/4 h-44 w-44 rounded-full bg-blue-100/50 blur-2xl dark:bg-blue-900/20" />

      <div className="relative px-4 py-10 text-center sm:py-14">
        <span className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40">
          <PlanArt />
        </span>
        <h1 className="mt-5 text-xl font-bold text-gray-900 dark:text-gray-100">Building your study plan</h1>
        <p className="mt-1.5 text-[14px] text-gray-500 dark:text-gray-400">{status?.stage_label ?? 'Starting up…'}</p>

        <div className="mx-auto mt-5 flex max-w-md items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950/60">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="w-9 text-right text-[13px] tabular-nums text-gray-500 dark:text-gray-400">{pct}%</span>
        </div>

        <ol className="mx-auto mt-6 max-w-[15rem] space-y-3 text-left">
          {STAGES.map((s, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li key={s} className="flex items-center gap-3">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
                ) : active ? (
                  <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-blue-500" />
                ) : (
                  <span className="h-5 w-5 flex-shrink-0 rounded-full border-2 border-blue-100 dark:border-blue-900/60" />
                )}
                <span
                  className={cn(
                    'text-[15px]',
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

        <p className="mt-8 text-[13px] text-gray-400">
          This usually takes under a minute. You can leave this page — the plan keeps building.
        </p>
      </div>
    </div>
  );
}

/** A plan page with a couple of sparkles — what is being made. Decorative. */
function PlanArt() {
  return (
    <svg viewBox="0 0 110 110" className="h-24 w-24" fill="none" aria-hidden="true">
      <rect x="22" y="30" width="56" height="64" rx="9" fill="#fff" stroke="#cfdcf5" strokeWidth="2" />
      <path d="M22 39a9 9 0 0 1 9-9h38a9 9 0 0 1 9 9v3H22z" fill="#2f7fe0" />
      <rect x="32" y="52" width="26" height="5" rx="2.5" fill="#bcd0f2" />
      <rect x="32" y="64" width="36" height="5" rx="2.5" fill="#d5e1f7" />
      <rect x="32" y="76" width="30" height="5" rx="2.5" fill="#d5e1f7" />
      <path d="M86 22c1.4 6 3.6 8.2 9.6 9.6-6 1.4-8.2 3.6-9.6 9.6-1.4-6-3.6-8.2-9.6-9.6 6-1.4 8.2-3.6 9.6-9.6z" fill="#2f7fe0" />
      <path d="M92 52c.9 3.7 2.3 5.1 6 6-3.7.9-5.1 2.3-6 6-.9-3.7-2.3-5.1-6-6 3.7-.9 5.1-2.3 6-6z" fill="#4d8ef7" />
      <circle cx="74" cy="18" r="2.2" fill="#9dbdf2" />
    </svg>
  );
}
