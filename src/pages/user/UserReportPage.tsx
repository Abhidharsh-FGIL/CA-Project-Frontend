import { useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { ArrowLeft } from 'lucide-react';
import { ReportBody } from '@/components/user/ReportBody';
import { reportLocked } from '@/lib/plan-notice';
import { showPlanNotice } from '@/lib/plan-notice-bus';
import { reportIsLocked } from '@/lib/report-access';

export default function UserReportPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { user, history, canDownloadPDF } = useUserPortal();

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
        onClick={() => navigate(-1)}
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-4 transition-colors animate-fadeIn"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back
      </button>

      <ReportBody attempt={attempt} canDownloadPDF={canDownloadPDF} />
    </UserShell>
  );
}
