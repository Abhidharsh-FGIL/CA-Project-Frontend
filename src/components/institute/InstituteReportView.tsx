import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileX } from 'lucide-react';
import { AttemptReport } from '@/components/user/ReportBody';
import { NoCopy } from '@/components/user/NoCopy';
import { instituteAttemptReport } from '@/lib/instituteApi';

/** Keys that copy, cut, select all, save, print or view the source. They do nothing while a report is open. */
const BLOCKED = new Set(['c', 'x', 'a', 's', 'p', 'u']);

/**
 * One student's report, as the student sees it, for the institute: read on the page, not taken away.
 * Text cannot be selected, copied, dragged or right-clicked, there is no PDF or question download, and printing
 * shows nothing. A browser can still take a screenshot; this stops the casual copy, not a determined one.
 */
export function InstituteReportView({ attemptId, studentName, onBack }: { attemptId: string; studentName?: string; onBack: () => void }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['institute-report', attemptId],
    queryFn: () => instituteAttemptReport(attemptId),
    staleTime: 5 * 60 * 1000,
    retry: (count, error) => (error as { status?: number })?.status !== 404 && count < 1,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && BLOCKED.has(e.key.toLowerCase())) e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // The report's own attempt block when the server sends one; else the little the page knows.
  const attempt = data?.attempt ?? {
    attempt_id: attemptId,
    test_name: data?.test_name ?? null,
    start_time: data?.start_time ?? null,
    end_time: data?.end_time ?? null,
    score: data?.score ?? null,
    max_score: data?.max_score ?? null,
    percentage: data?.percentage ?? null,
    status: data?.status ?? 'submitted',
    auto_submitted: data?.auto_submitted ?? false,
    malpractice_events: [],
  };

  return (
    <div className="space-y-4">
      {/* Printing shows a notice instead of the report. */}
      <style>{`
        @media print {
          .institute-report { display: none !important; }
          .institute-print-notice { display: block !important; }
        }
      `}</style>
      <p className="institute-print-notice hidden text-center text-sm">This report is for viewing on the page only.</p>

      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to {studentName ? `${studentName}’s tests` : 'tests'}
      </button>

      {!isLoading && (isError || !data) ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
          <FileX className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">This report could not be opened</p>
        </div>
      ) : (
        <NoCopy className="institute-report">
          <AttemptReport
            detail={data ?? null}
            attempt={attempt}
            courseName={null}
            canDownloadPDF={false}
            readOnly
            loading={isLoading}
            fetchError={false}
            studentName={data?.student_name || studentName || 'Student'}
          />
        </NoCopy>
      )}
    </div>
  );
}
