import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { originOf } from '@/lib/report-origin';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { ArrowLeft } from 'lucide-react';
import { ReportBody } from '@/components/user/ReportBody';
import { NoCopy } from '@/components/user/NoCopy';
import { reportLocked } from '@/lib/plan-notice';
import { showPlanNotice } from '@/lib/plan-notice-bus';
import { reportIsLocked } from '@/lib/report-access';
import { PassCelebration } from '@/components/user/PassCelebration';
import { levelFromTitle, passMarkFor, performanceOf } from '@/config/pass-marks';
import { stageForTitle } from '@/config/tnpsc';
import { NextUpCard } from '@/components/user/NextBestPractice';

export default function UserReportPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, history, canDownloadPDF } = useUserPortal();
  // Back returns to the page the report was opened from; without one (opened straight from a
  // link or after submitting a test) it goes to the previous entry, as it always did.
  const origin = originOf(location.state);

  const attempt = history.find(h => h.attempt_id === attemptId);
  // The links to a report already stop a locked one; this is for the address typed or bookmarked.
  const locked = !!attempt && reportIsLocked(user?.subscription_tier, attempt.test_mode);
  useEffect(() => {
    if (locked) showPlanNotice(reportLocked());
  }, [locked]);

  // Celebrate a pass once, and only when the report is opened right after submitting - not on every visit.
  const performance = attempt
    ? performanceOf(
        attempt.percentage,
        passMarkFor({ kind: attempt.test_mode === 'mock' ? 'mock' : 'practice', level: levelFromTitle(attempt.test_name) }),
      )
    : null;
  const celebrateKey = attemptId ? `mge:celebrated:${attemptId}` : null;
  const [celebrate, setCelebrate] = useState(() => {
    if (!(location.state as { justSubmitted?: boolean } | null)?.justSubmitted || !celebrateKey) return false;
    try {
      return !sessionStorage.getItem(celebrateKey);
    } catch {
      return true;
    }
  });
  const doneCelebrating = useCallback(() => {
    setCelebrate(false);
    try {
      if (celebrateKey) sessionStorage.setItem(celebrateKey, '1');
    } catch {
      /* private window: it may play again on a refresh, which is harmless */
    }
  }, [celebrateKey]);

  // Right after a submit, the report also says what to practise next, for the exam this paper belongs to.
  const justSubmitted = !!(location.state as { justSubmitted?: boolean } | null)?.justSubmitted;
  const nextStage = stageForTitle(attempt?.test_name);

  if (!attempt || locked) return <Navigate to="/user/history" replace />;

  return (
    <UserShell>
      <button
        data-no-print
        onClick={() => (origin ? navigate(origin) : navigate(-1))}
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-4 transition-colors animate-fadeIn"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back
      </button>

      {celebrate && performance && performance !== 'needs-improvement' && attempt.percentage != null && (
        <PassCelebration performance={performance} percent={attempt.percentage} onDone={doneCelebrating} />
      )}

      {justSubmitted && nextStage && (
        <NextUpCard exam={nextStage.group_id} stage={nextStage.id} justTaken={attempt.test_id} />
      )}

      <NoCopy>
        <ReportBody attempt={attempt} canDownloadPDF={canDownloadPDF} />
      </NoCopy>
    </UserShell>
  );
}
