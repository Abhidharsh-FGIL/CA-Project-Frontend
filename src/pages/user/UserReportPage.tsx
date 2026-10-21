import { useEffect } from 'react';
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

  if (!attempt || locked) return <Navigate to="/user/history" replace />;

  return (
    <UserShell>
      <button
        onClick={() => (origin ? navigate(origin) : navigate(-1))}
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-4 transition-colors animate-fadeIn"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back
      </button>

      <NoCopy>
        <ReportBody attempt={attempt} canDownloadPDF={canDownloadPDF} />
      </NoCopy>
    </UserShell>
  );
}
