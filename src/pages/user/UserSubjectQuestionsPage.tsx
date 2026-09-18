/**
 * /user/report/:attemptId/subjects/:subjectId/questions — "Question Insights"
 * (mockup screen 4).
 */
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { ReportSubNav } from '@/components/user/ReportSubNav';
import { SubjectQuestionsPage } from '@/components/user/report/SubjectQuestionsPage';
import { useAttemptReportModel } from '@/hooks/use-attempt-report';

export default function UserSubjectQuestionsPage() {
  const { attemptId, subjectId } = useParams<{ attemptId: string; subjectId: string }>();
  const navigate = useNavigate();
  const { model, loading, failed } = useAttemptReportModel(attemptId);
  if (!attemptId) return <Navigate to="/user/history" replace />;

  const subject = model?.subjects.find(s => s.subjectId === subjectId);

  return (
    <UserShell>
      <ReportSubNav attemptId={attemptId} active="subjects" />
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : failed || !model ? (
        <div className="p-6 max-w-2xl mx-auto">
          <p className="text-sm text-gray-500 dark:text-gray-400">This attempt's detail could not be loaded.</p>
        </div>
      ) : !subject ? (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
          <button
            onClick={() => navigate(`/user/report/${attemptId}/subjects`)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Subjects
          </button>
          <p className="text-sm text-gray-500 dark:text-gray-400">This subject wasn't found on this attempt.</p>
        </div>
      ) : (
        <SubjectQuestionsPage model={model} subject={subject} />
      )}
    </UserShell>
  );
}
