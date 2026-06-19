import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { startTestAttempt, type TestDetail } from '@/lib/userPortalApi';
import { toast } from 'sonner';

interface ReadyState {
  test: TestDetail;
  course_id: string;
}

export default function TestReadyPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ReadyState | null;

  const [starting, setStarting] = useState(false);

  if (!state?.test || !testId) {
    navigate('/user/courses', { replace: true });
    return null;
  }

  const { test } = state;
  const isMock = test.mode === 'mock';

  const handleStartAssessment = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const result = await startTestAttempt(testId);
      navigate(`/user/test/${testId}/take`, {
        replace: true,
        state: {
          attempt_id: result.attempt_id,
          test_name: test.name ?? 'Test',
          subject: test.subject ?? null,
          mode: test.mode,
          questions: result.questions,
          time_limit: result.time_limit,
          negative_marking: result.negative_marking,
          negative_marking_fraction: result.negative_marking_fraction,
          course_id: test.course_id,
        },
      });
    } catch (err: any) {
      toast.error(err?.message || 'Could not start test. Please try again.');
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 max-w-md w-full overflow-hidden">
        {/* Top colour bar */}
        <div className={`h-1.5 w-full ${isMock ? 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500' : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400'}`} />

        <div className="p-6 sm:p-8">
          {/* Subject tag */}
          {test.subject && (
            <p className="text-center text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-4">
              {test.subject}
            </p>
          )}

          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center">
              <svg className="w-7 h-7 text-indigo-500 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 text-center leading-snug mb-2">
            {test.name ?? 'Untitled Test'}
          </h1>

          {/* Mode badge */}
          <div className="flex justify-center mb-6">
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${
              isMock
                ? 'text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800'
                : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
            }`}>
              {isMock ? 'Mock Exam' : 'Practice Mode'}
            </span>
          </div>

          {/* Stats */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden mb-5">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total Questions</span>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{test.question_count}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">Time Limit</span>
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                {test.time_limit > 0 ? `${test.time_limit} minutes` : 'No limit'}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">Negative Marking</span>
              <span className={`text-sm font-bold ${test.negative_marking ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
                {test.negative_marking ? `Yes (-${test.negative_marking_fraction})` : 'No'}
              </span>
            </div>
          </div>

          {/* Warning */}
          <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 mb-6">
            <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <strong>Important:</strong> Do not switch tabs or leave this page during the assessment. You will receive warnings for tab switching. After 3 violations, your assessment will be auto-submitted.
            </p>
          </div>

          {/* Start button */}
          <button
            onClick={handleStartAssessment}
            disabled={starting}
            className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right-bottom text-white py-3.5 rounded-xl font-semibold text-sm transition-all duration-500 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {starting ? (
              <span className="inline-flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Starting…
              </span>
            ) : (
              'Start Assessment'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
