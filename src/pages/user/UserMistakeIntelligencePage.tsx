/**
 * /user/report/:attemptId/mistakes — "Mistake Intelligence" (mockup screen 6).
 */
import { useParams, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { ReportSubNav } from '@/components/user/ReportSubNav';
import { MistakeIntelligence } from '@/components/user/report/MistakeIntelligence';
import { useAttemptReportModel } from '@/hooks/use-attempt-report';

export default function UserMistakeIntelligencePage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { model, loading, failed } = useAttemptReportModel(attemptId);
  if (!attemptId) return <Navigate to="/user/history" replace />;

  return (
    <UserShell>
      <ReportSubNav attemptId={attemptId} active="mistakes" />
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : failed || !model ? (
        <div className="p-6 max-w-2xl mx-auto">
          <p className="text-sm text-gray-500 dark:text-gray-400">This attempt's detail could not be loaded.</p>
        </div>
      ) : (
        <MistakeIntelligence model={model} />
      )}
    </UserShell>
  );
}
