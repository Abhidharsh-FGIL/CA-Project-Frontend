/**
 * /user/report/:attemptId/subjects — the "View All Subjects" destination from the
 * Overview screen, and where the report sub-nav's "Subjects" tab points.
 *
 * Reuses the existing full subject table (`SubjectPerformance`, already built for
 * the admin-shared report) as-is — no new table. Its row click normally toggles an
 * inline expand; here it navigates to the Subject Deep Dive route instead
 * (`expanded` is always null, so that inline-expand branch never renders).
 */
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { ReportSubNav } from '@/components/user/ReportSubNav';
import { SubjectPerformance } from '@/components/user/AttemptDiagnosticReport';
import { useAttemptReportModel } from '@/hooks/use-attempt-report';
import { ReportGate } from '@/components/user/report/ReportGate';

export default function UserAllSubjectsPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const { model, loading, failed, analysis, analysisPhase, retryAnalysis } = useAttemptReportModel(attemptId);
  if (!attemptId) return <Navigate to="/user/history" replace />;

  return (
    <UserShell>
      <ReportSubNav attemptId={attemptId} active="subjects" />
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        <button
          onClick={() => navigate(`/user/report/${attemptId}`)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Report
        </button>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : failed || !model ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">This attempt's detail could not be loaded.</p>
        ) : (
          <ReportGate phase={analysisPhase} analysis={analysis} onRetry={retryAnalysis}>
            <SubjectPerformance
              model={model}
              expanded={null}
              onToggle={subjectId => navigate(`/user/report/${attemptId}/subjects/${subjectId}`)}
            />
          </ReportGate>
        )}
      </div>
    </UserShell>
  );
}
