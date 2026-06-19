import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import {
  Clock,
  FileText,
  AlertTriangle,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { getTestDetail, type TestDetail } from '@/lib/userPortalApi';

export default function TestStartPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<TestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!testId) return;
    setLoading(true);
    getTestDetail(testId)
      .then(setTest)
      .catch(err => setError(err?.message || 'Failed to load test details.'))
      .finally(() => setLoading(false));
  }, [testId]);

  const handleBegin = () => {
    if (!agreed || !test || !testId) return;
    navigate(`/user/test/${testId}/ready`, {
      state: { test, course_id: test.course_id },
    });
  };

  if (loading) {
    return (
      <UserShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        </div>
      </UserShell>
    );
  }

  if (error || !test) {
    return (
      <UserShell>
        <div className="max-w-xl mx-auto mt-16 text-center">
          <p className="text-red-600 font-semibold mb-4">{error || 'Test not found.'}</p>
          <button
            onClick={() => navigate('/user/courses')}
            className="text-indigo-600 hover:underline text-sm"
          >
            Back to Courses
          </button>
        </div>
      </UserShell>
    );
  }

  const isMock = test.mode === 'mock';

  return (
    <UserShell>
      <button
        onClick={() => navigate(`/user/courses/${test.course_id}`)}
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-4 transition-colors animate-fadeIn"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to Course
      </button>

      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-5 animate-scaleIn">
          {/* Gradient hero band */}
          <div
            className={`relative p-5 sm:p-6 lg:p-8 overflow-hidden ${
              isMock
                ? 'bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500'
                : 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500'
            } text-white`}
          >
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-black/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="text-[10px] font-bold uppercase tracking-[0.25em] bg-white/20 backdrop-blur border border-white/30 text-white px-2.5 py-1 rounded-full whitespace-nowrap">
                    {isMock ? '★ Mock Exam' : 'Practice Mode'}
                  </span>
                  {test.subject && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90 truncate">
                      {test.subject}
                    </span>
                  )}
                </div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight">
                  {test.name ?? 'Untitled Test'}
                </h1>
                <p className="text-xs sm:text-sm opacity-90 mt-2 font-serif italic">
                  {isMock
                    ? 'Full-length, time-bound simulation. Treat it like the real thing.'
                    : 'Practice freely — no rank, just learning.'}
                </p>
              </div>

              <div className="flex-shrink-0 self-start bg-white/15 backdrop-blur border border-white/25 rounded-xl px-3 py-2 text-right">
                <p className="text-[9px] uppercase tracking-widest opacity-80">Test Fee</p>
                <p className="text-lg font-bold leading-tight">
                  {test.price > 0 ? `₹${test.price}` : 'FREE'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {/* Info grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoTile
                icon={<FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                label="Questions"
                value={String(test.question_count)}
              />
              <InfoTile
                icon={<Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                label="Time Limit"
                value={test.time_limit > 0 ? `${test.time_limit} min` : 'Untimed'}
              />
              <InfoTile
                icon={<Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                label="Difficulty"
                value={test.difficulty ?? 'Mixed'}
                valueClass="capitalize"
              />
              <InfoTile
                icon={<AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />}
                label="Negative Marking"
                value={test.negative_marking ? `Yes (-${test.negative_marking_fraction})` : 'No'}
              />
            </div>

            {/* Instructions */}
            <div className="mt-6 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Instructions
              </p>
              <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1.5 list-disc pl-5">
                <li>Read each question carefully before answering.</li>
                <li>You can flag questions for review and revisit them before submitting.</li>
                {isMock && <li>The timer cannot be paused. The test will auto-submit when time expires.</li>}
                <li>Do not switch tabs or leave this page during the assessment.</li>
                <li>
                  After <strong>3 tab-switch violations</strong>, your test will be auto-submitted.
                </li>
                <li>Right-click and copy-paste are disabled during the test.</li>
                {test.negative_marking && (
                  <li className="text-red-700 dark:text-red-300">
                    <strong>Negative marking is enabled.</strong> Each wrong answer deducts{' '}
                    {test.negative_marking_fraction} marks.
                  </li>
                )}
              </ul>
            </div>

            <label className="mt-5 flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreed}
                onChange={e => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400"
              />
              <span className="text-xs text-gray-700 dark:text-gray-300">
                I have read and understood the instructions. I agree to abide by the anti-malpractice rules.
              </span>
            </label>

            <button
              onClick={handleBegin}
              disabled={!agreed}
              className="group w-full mt-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right-bottom text-white py-3.5 rounded-xl font-semibold transition-all duration-500 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 hover:shadow-xl hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none press"
            >
              <span className="inline-flex items-center justify-center gap-2">
                Begin Test
                <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </UserShell>
  );
}

function InfoTile({
  icon,
  label,
  value,
  valueClass = '',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100/70 dark:from-gray-800/80 dark:to-gray-800/40 rounded-xl p-3 hover:from-indigo-50 hover:to-purple-50 dark:hover:from-indigo-950/40 dark:hover:to-purple-950/40 transition-colors duration-300">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className={`text-base font-bold text-gray-900 dark:text-gray-100 mt-1 ${valueClass}`}>{value}</p>
    </div>
  );
}
