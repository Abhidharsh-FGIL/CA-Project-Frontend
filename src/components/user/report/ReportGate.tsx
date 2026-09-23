/**
 * The one place that decides whether a report screen may render.
 *
 * Every screen in the report flow is gated on this. Before it existed, a
 * screen opened while the analysis was still generating rendered anyway, each
 * section quietly substituting something for the content it didn't have — and
 * in Mistake Intelligence's case that substitute was a fixed, invented list of
 * patterns and counts ("6 questions", "5 questions") that had nothing to do
 * with the attempt on screen. An aspirant has no way to tell invented content
 * from analysed content, so the only safe rule is that the report waits.
 *
 * `POST /analysis` answering `{"status":"dispatched"}` and `GET /analysis`
 * answering `{"status":"not_started"}` or `{"status":"generating"}` all mean
 * the same thing here: there is no analysis yet, so there is no report yet.
 * The hook polls in the background, so this resolves on its own without the
 * aspirant reloading anything.
 *
 * The decision itself lives in `report-gate-state.ts`; this file only renders
 * it.
 */
import type { ReactNode } from 'react';
import { Loader2, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import type { AnalysisPhase } from '@/lib/analysis-poll';
import type { AttemptAnalysisResponse } from '@/lib/userPortalApi';
import { gateState } from '@/components/user/report/report-gate-state';

function GateCard({
  icon,
  title,
  body,
  emphasis,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  /** Called out above the body, in red — the expected wait. */
  emphasis?: string;
  children?: ReactNode;
}) {
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm px-6 py-10 text-center">
        <span className="inline-flex w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 items-center justify-center mb-4">
          {icon}
        </span>
        <p className="text-[15px] font-bold text-gray-900 dark:text-gray-100">{title}</p>
        {emphasis && (
          <p className="text-[13px] font-bold text-red-600 dark:text-red-400 mt-1.5">{emphasis}</p>
        )}
        <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed max-w-md mx-auto">{body}</p>
        {children}
      </div>
    </div>
  );
}

export function ReportGate({
  phase,
  analysis,
  section,
  onRetry,
  children,
}: {
  phase: AnalysisPhase;
  analysis: AttemptAnalysisResponse | null;
  /**
   * The analysis section this screen is built around — Mistake Intelligence
   * needs `error_intelligence`, the Study Plan needs `weekly_plan`. Omit for
   * screens whose content spans several sections (the Overview), which then
   * wait only on the pipeline as a whole.
   */
  section?: keyof AttemptAnalysisResponse;
  onRetry?: () => void;
  children: ReactNode;
}) {
  const state = gateState(phase, analysis, section);

  switch (state.kind) {
    case 'ready':
      return <>{children}</>;

    case 'spinner':
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      );

    case 'waiting':
      return (
        <GateCard
          icon={<Loader2 className="w-6 h-6 animate-spin" />}
          title={state.title}
          emphasis={state.emphasis}
          body={state.body}
        />
      );

    case 'section-waiting':
      return <GateCard icon={<Sparkles className="w-6 h-6" />} title={state.title} body={state.body} />;

    case 'error':
      return (
        <GateCard icon={<AlertTriangle className="w-6 h-6" />} title={state.title} body={state.body}>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-semibold px-4 py-2 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {state.retryLabel}
            </button>
          )}
        </GateCard>
      );
  }
}
