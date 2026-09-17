import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { MathText } from '@/components/ui/MathText';
import {
  saveTestAnswer,
  flagTestQuestion,
  recordTestMalpractice,
  submitTestAttempt,
  type TestEngineQuestion,
} from '@/lib/userPortalApi';
import { toast } from 'sonner';
import { useUserPortal } from '@/contexts/UserPortalContext';

// ── Types ──────────────────────────────────────────────────────────────────────

type QStatus = 'not_visited' | 'not_answered' | 'answered' | 'marked_review' | 'answered_marked';

interface TakeState {
  attempt_id: string;
  test_name: string;
  subject: string | null;
  mode: 'practice' | 'mock';
  questions: TestEngineQuestion[];
  time_limit: number;
  negative_marking: boolean;
  negative_marking_fraction: number;
  course_id: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function padTime(n: number) {
  return String(n).padStart(2, '0');
}

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ── Circular Timer ─────────────────────────────────────────────────────────────

function CircularTimer({
  secondsLeft,
  totalSeconds,
  display,
  urgent,
}: {
  secondsLeft: number | null;
  totalSeconds: number;
  display: string | null;
  urgent: boolean;
}) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const progress =
    secondsLeft !== null && totalSeconds > 0
      ? Math.max(0, Math.min(1, secondsLeft / totalSeconds))
      : 1;
  const offset = circ * (1 - progress);

  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 52 52">
        <circle
          cx="26" cy="26" r={r}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="3"
        />
        <circle
          cx="26" cy="26" r={r}
          fill="none"
          stroke={urgent ? '#f87171' : '#818cf8'}
          strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums ${
          urgent ? 'text-red-300' : 'text-white'
        }`}
      >
        {display ?? '—'}
      </span>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TestTakingPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as TakeState | null;
  const { user } = useUserPortal();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, QStatus>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const malpracticeCount = useRef(0);
  // Per-question time tracking: timestamp when user entered current question
  const questionStartRef = useRef<number>(Date.now());
  // Accumulated seconds per question (handles returning to a question)
  const questionAccumRef = useRef<Record<string, number>>({});

  if (!state) {
    navigate('/user/courses', { replace: true });
    return null;
  }

  const {
    attempt_id,
    test_name,
    subject,
    questions,
    time_limit,
    negative_marking,
    negative_marking_fraction,
  } = state;

  // Initialize question statuses on mount
  useEffect(() => {
    const init: Record<string, QStatus> = {};
    questions.forEach((q, i) => {
      init[q.question_id] = i === 0 ? 'not_answered' : 'not_visited';
    });
    setStatuses(init);
  }, []);

  // Start timer on mount
  useEffect(() => {
    if (time_limit <= 0 || submitted) return;
    setSecondsLeft(time_limit * 60);
  }, []);

  useEffect(() => {
    if (secondsLeft === null || submitted) return;
    if (secondsLeft <= 0) {
      handleAutoSubmit('time_expired');
      return;
    }
    const id = setTimeout(() => setSecondsLeft(s => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, submitted]);

  // Malpractice: tab-switch detection
  useEffect(() => {
    if (submitted) return;
    const onVisibilityChange = () => {
      if (document.hidden) {
        malpracticeCount.current += 1;
        recordTestMalpractice(attempt_id, 'tab_switch').catch(() => {});
        if (malpracticeCount.current >= 3) {
          toast.error('Auto-submitted: 3 tab-switch violations detected.');
          handleAutoSubmit('malpractice');
        } else {
          toast.warning(
            `Tab switch detected (${malpracticeCount.current}/3). Test will auto-submit on 3rd violation.`
          );
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [submitted]);

  // Right-click and copy-paste prevention
  useEffect(() => {
    if (submitted) return;
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    document.addEventListener('copy', prevent);
    document.addEventListener('paste', prevent);
    return () => {
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('copy', prevent);
      document.removeEventListener('paste', prevent);
    };
  }, [submitted]);

  const selectAnswer = useCallback(
    (questionId: string, answer: string) => {
      setAnswers(prev => ({ ...prev, [questionId]: answer }));
      setStatuses(prev => {
        const current = prev[questionId];
        const next =
          current === 'marked_review' || current === 'answered_marked'
            ? 'answered_marked'
            : 'answered';
        return { ...prev, [questionId]: next };
      });
      const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
      const timeSpent = (questionAccumRef.current[questionId] ?? 0) + elapsed;
      saveTestAnswer(attempt_id, questionId, answer, timeSpent).catch(() => {});
    },
    [attempt_id]
  );

  const clearAnswer = useCallback(
    (questionId: string) => {
      setAnswers(prev => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      setStatuses(prev => ({ ...prev, [questionId]: 'not_answered' }));
      const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
      const timeSpent = (questionAccumRef.current[questionId] ?? 0) + elapsed;
      saveTestAnswer(attempt_id, questionId, '', timeSpent).catch(() => {});
    },
    [attempt_id]
  );

  const toggleFlag = useCallback(
    (questionId: string) => {
      setFlagged(prev => {
        const next = new Set(prev);
        const nowFlagged = !next.has(questionId);
        if (nowFlagged) next.add(questionId);
        else next.delete(questionId);
        flagTestQuestion(attempt_id, questionId, nowFlagged).catch(() => {});
        return next;
      });
      setStatuses(prev => {
        const cur = prev[questionId];
        if (cur === 'answered') return { ...prev, [questionId]: 'answered_marked' };
        if (cur === 'answered_marked') return { ...prev, [questionId]: 'answered' };
        if (cur === 'not_answered') return { ...prev, [questionId]: 'marked_review' };
        if (cur === 'marked_review') return { ...prev, [questionId]: 'not_answered' };
        return prev;
      });
    },
    [attempt_id]
  );

  const goToQuestion = (idx: number) => {
    if (idx < 0 || idx >= questions.length) return;
    // Accumulate time spent on the question we're leaving
    const leavingQid = questions[currentIdx].question_id;
    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    questionAccumRef.current[leavingQid] = (questionAccumRef.current[leavingQid] ?? 0) + elapsed;
    questionStartRef.current = Date.now();

    const qid = questions[idx].question_id;
    setStatuses(prev => {
      if (prev[qid] === 'not_visited') return { ...prev, [qid]: 'not_answered' };
      return prev;
    });
    setCurrentIdx(idx);
    setPanelOpen(false);
  };

  const handleMarkForReview = () => {
    toggleFlag(currentQ.question_id);
    goToQuestion(currentIdx + 1);
  };

  const handleAutoSubmit = async (reason: 'malpractice' | 'time_expired') => {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      await submitTestAttempt(attempt_id, {
        tab_violations: malpracticeCount.current,
        submit_reason: reason === 'malpractice' ? 'tab_violations' : 'time_expired',
      });
      setSubmitted(true);
      toast.success('Test submitted.');
      navigate(`/user/courses/${state.course_id}`, { replace: true });
    } catch {
      // Best-effort
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    setShowConfirm(false);
    try {
      await submitTestAttempt(attempt_id, {
        tab_violations: malpracticeCount.current,
        submit_reason: 'manual',
      });
      setSubmitted(true);
      toast.success('Test submitted successfully!');
      navigate(`/user/courses/${state.course_id}`, { replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit test. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived counts ─────────────────────────────────────────────────────────

  const answered = Object.values(statuses).filter(
    s => s === 'answered' || s === 'answered_marked'
  ).length;
  const markedReview = Object.values(statuses).filter(
    s => s === 'marked_review' || s === 'answered_marked'
  ).length;
  const remaining = questions.length - answered;

  const currentQ = questions[currentIdx];

  const STATUS_STYLE: Record<QStatus, string> = {
    not_visited: 'bg-white border border-gray-300 text-gray-500',
    not_answered: 'bg-pink-200 border border-pink-300 text-pink-800',
    answered: 'bg-emerald-500 text-white border border-emerald-500',
    marked_review: 'bg-amber-400 text-white border border-amber-400',
    answered_marked: 'bg-blue-500 text-white border border-blue-500',
  };

  // ── Timer display ──────────────────────────────────────────────────────────

  const timerDisplay = (() => {
    if (secondsLeft === null) return null;
    const h = Math.floor(secondsLeft / 3600);
    const m = Math.floor((secondsLeft % 3600) / 60);
    const s = secondsLeft % 60;
    return h > 0
      ? `${padTime(h)}:${padTime(m)}:${padTime(s)}`
      : `${padTime(m)}:${padTime(s)}`;
  })();

  const timerUrgent = secondsLeft !== null && secondsLeft <= 300;

  // ── Sidebar content (reused in both desktop and mobile) ───────────────────

  const SidebarContent = () => (
    <>
      {/* User info */}
      {user && (
        <div className="flex items-center gap-2.5 mb-4 p-3 bg-white rounded-xl border border-gray-200">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            {(user.name?.[0] ?? 'U').toUpperCase()}
          </div>
          <p className="text-xs text-gray-600 truncate">{user.email}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2.5 bg-white rounded-xl border border-gray-200">
          <p className="text-xl font-bold text-emerald-600">{answered}</p>
          <p className="text-[10px] text-emerald-600 font-semibold">Answered</p>
        </div>
        <div className="text-center p-2.5 bg-white rounded-xl border border-gray-200">
          <p className="text-xl font-bold text-gray-900">{remaining}</p>
          <p className="text-[10px] text-gray-500 font-semibold">Remaining</p>
        </div>
        <div className="text-center p-2.5 bg-white rounded-xl border border-gray-200">
          <p className="text-xl font-bold text-amber-500">{markedReview}</p>
          <p className="text-[10px] text-amber-500 font-semibold">Review</p>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 space-y-1.5">
        {[
          { cls: 'bg-white border border-gray-300', label: 'Not Visited' },
          { cls: 'bg-pink-200 border border-pink-300', label: 'Not Answered' },
          { cls: 'bg-emerald-500', label: 'Answered' },
          { cls: 'bg-amber-400', label: 'Marked for Review' },
          { cls: 'bg-blue-500', label: 'Answered & Marked' },
        ].map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-3.5 h-3.5 rounded flex-shrink-0 ${cls}`} />
            <span className="text-[11px] text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Question grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
          QUESTIONS
        </p>
        <div className="grid grid-cols-6 gap-1.5">
          {questions.map((q, idx) => {
            const st = statuses[q.question_id] ?? 'not_visited';
            const isCurrent = idx === currentIdx;
            return (
              <button
                key={q.question_id}
                onClick={() => goToQuestion(idx)}
                className={`w-full aspect-square rounded-lg text-[11px] font-bold flex items-center justify-center transition-all ${STATUS_STYLE[st]} ${
                  isCurrent ? 'ring-2 ring-offset-1 ring-indigo-500' : 'hover:scale-110'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  // ── Main test interface ────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-slate-100 select-none overflow-hidden">
      {/* Dark header */}
      <header className="flex-shrink-0 bg-slate-900 text-white shadow-lg z-30">
        <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            {subject && (
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] leading-none mb-0.5">
                {subject}
              </p>
            )}
            <p className="text-sm sm:text-[15px] font-bold leading-snug truncate">{test_name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Q {currentIdx + 1} of {questions.length}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {timerDisplay && (
              <CircularTimer
                secondsLeft={secondsLeft}
                totalSeconds={time_limit > 0 ? time_limit * 60 : 3600}
                display={timerDisplay}
                urgent={timerUrgent}
              />
            )}

            <button
              onClick={() => setShowConfirm(true)}
              disabled={submitting}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Submit
            </button>

            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setPanelOpen(p => !p)}
              className="lg:hidden p-2 text-gray-300 hover:text-white"
              aria-label="Toggle question panel"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden max-w-screen-xl mx-auto w-full">
        {/* Question area */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4">
          {currentQ && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
              {/* Question with number badge */}
              <div className="flex items-start gap-4 mb-5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {currentIdx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  {currentQ.title && currentQ.title !== currentQ.body && (
                    <p className="text-xs text-gray-500 italic mb-1">
                      <MathText text={currentQ.title} />
                    </p>
                  )}
                  <div className="text-sm sm:text-[15px] font-medium text-gray-900 leading-relaxed">
                    <MathText text={currentQ.body} />
                  </div>
                  {/* Marks & subject tags */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                      1 mark
                    </span>
                    {negative_marking && negative_marking_fraction > 0 && (
                      <span className="text-[11px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded font-medium">
                        -{negative_marking_fraction} negative
                      </span>
                    )}
                    {currentQ.subject && (
                      <span className="text-[11px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded font-medium">
                        {currentQ.subject}
                      </span>
                    )}
                    {currentQ.difficulty && (
                      <span className="text-[11px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded font-medium capitalize">
                        {currentQ.difficulty}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* MCQ options */}
              {(currentQ.question_type === 'mcq' || currentQ.question_type === 'true_false') &&
                currentQ.options && (
                  <div className="space-y-2.5 pl-[52px]">
                    {currentQ.options.map((opt, idx) => {
                      const key = OPTION_KEYS[idx] ?? String(idx);
                      const label = OPTION_LABELS[idx] ?? String(idx + 1);
                      const isSelected = answers[currentQ.question_id] === key;
                      return (
                        <button
                          key={key}
                          onClick={() => selectAnswer(currentQ.question_id, key)}
                          className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-150 ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <span
                            className={`flex-shrink-0 w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {label}
                          </span>
                          <span
                            className={`text-sm ${
                              isSelected
                                ? 'text-indigo-900 font-medium'
                                : 'text-gray-700'
                            }`}
                          >
                            <MathText text={String(opt)} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

              {/* Short answer */}
              {(currentQ.question_type === 'fill' || currentQ.question_type === 'short') && (
                <input
                  type="text"
                  value={answers[currentQ.question_id] ?? ''}
                  onChange={e => selectAnswer(currentQ.question_id, e.target.value)}
                  placeholder="Type your answer here..."
                  className="w-full ml-[52px] px-4 py-3 border-2 border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                />
              )}

              {/* Long answer */}
              {currentQ.question_type === 'long' && (
                <textarea
                  value={answers[currentQ.question_id] ?? ''}
                  onChange={e => selectAnswer(currentQ.question_id, e.target.value)}
                  placeholder="Type your detailed answer here..."
                  rows={5}
                  className="w-full ml-[52px] px-4 py-3 border-2 border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y text-sm"
                />
              )}

              {/* Action row */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={handleMarkForReview}
                  className="border border-amber-400 text-amber-700 bg-white hover:bg-amber-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                >
                  Mark for Review & Next
                </button>
                {answers[currentQ.question_id] && (
                  <button
                    onClick={() => clearAnswer(currentQ.question_id)}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                  >
                    Clear response
                  </button>
                )}
              </div>

              {/* Navigation */}
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  onClick={() => goToQuestion(currentIdx - 1)}
                  disabled={currentIdx === 0}
                  className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                <button
                  onClick={() => goToQuestion(currentIdx + 1)}
                  disabled={currentIdx === questions.length - 1}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Save & Next
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-72 xl:w-80 flex-shrink-0 overflow-y-auto p-4 gap-0">
          <SidebarContent />
        </aside>
      </div>

      {/* Mobile sidebar overlay */}
      {panelOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setPanelOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-80 bg-slate-100 overflow-y-auto p-4 flex flex-col gap-0 lg:hidden shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">Questions</p>
              <button
                onClick={() => setPanelOpen(false)}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Submit confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Submit Assessment?</h3>

            {/* Stats table */}
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
              {[
                { label: 'Total Questions', value: questions.length, cls: 'text-gray-900' },
                { label: 'Answered', value: answered, cls: 'text-emerald-600' },
                { label: 'Not Answered', value: questions.length - answered, cls: 'text-red-600' },
                { label: 'Marked for Review', value: markedReview, cls: 'text-amber-600' },
              ].map(({ label, value, cls }, i, arr) => (
                <div
                  key={label}
                  className={`flex items-center justify-between px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <span className={`text-sm font-medium ${cls}`}>{label}</span>
                  <span className={`text-sm font-bold ${cls}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Warning if unanswered */}
            {questions.length - answered > 0 && (
              <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-xs text-amber-800 leading-relaxed">
                  You have <strong>{questions.length - answered}</strong> unanswered question(s). Are you sure you want to submit?
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-sm"
              >
                Go Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50 transition-colors text-sm"
              >
                {submitting ? 'Submitting…' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
