import { useParams, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { ReportSubNav } from '@/components/user/ReportSubNav';
import { ReportOverview } from '@/components/user/report/ReportOverview';
import { useAttemptReportModel } from '@/hooks/use-attempt-report';

export default function UserReportPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { model, examContext, loading, failed, analysis } = useAttemptReportModel(attemptId);

  if (!attemptId) return <Navigate to="/user/history" replace />;

  return (
    <UserShell>
      <ReportSubNav attemptId={attemptId} active="overview" />
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : failed || !model ? (
        <div className="p-6 max-w-2xl mx-auto">
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This attempt's detail could not be loaded.
            </p>
          </div>
        </div>
      ) : (
        <ReportOverview model={model} exam={examContext} analysis={analysis} />
      )}
    </UserShell>
  );
}
