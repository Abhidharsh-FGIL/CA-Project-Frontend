import { useCallback, type MouseEvent } from 'react';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { reportLocked } from '@/lib/plan-notice';
import { showPlanNotice } from '@/lib/plan-notice-bus';
import { reportIsLocked } from '@/lib/report-access';

/**
 * For a link to an attempt's report: `onClick={gate(attempt.test_mode)}`.
 *
 * When the person's plan does not include that report the click goes nowhere and the plan popup
 * opens instead; otherwise the link works as it always did.
 */
export function useReportGate() {
  const { user } = useUserPortal();
  const tier = user?.subscription_tier;
  return useCallback(
    (testMode: string | null | undefined) => (e: MouseEvent) => {
      if (!reportIsLocked(tier, testMode)) return;
      e.preventDefault();
      showPlanNotice(reportLocked());
    },
    [tier],
  );
}
