import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BASE_URL, buildUrl } from '@/lib/api';
import { MathText } from '@/components/ui/MathText';
import { SAMPLE_TESTS, SAMPLE_COURSES } from '@/data/userPortalSampleData';
import { generateDemoQuestions } from '@/data/sampleQuestions';

const API_BASE = `${BASE_URL}/api/v1/evaluation`;

const isDemoToken = (token: string) => token.startsWith('demo-');

type PageState = 'loading' | 'landing' | 'active' | 'submitting' | 'submitted' | 'error';
type QuestionStatus = 'not_visited' | 'not_answered' | 'answered' | 'marked_review' | 'answered_marked';

interface AssessmentInfo {
  assessment_title: string;
  mode: string;
  question_count: number | null;
  time_limit: number | null;
  negative_marking: boolean;
  due_date: string | null;
  max_attempts: number | null;
  attempts_used: number;
  can_attempt: boolean;
  invitation_status: string;
  email: string;
  organization_name: string | null;
}

interface Question {
  id: string;
  question_type: string;
  question_text: string;
  options: any;
  marks: number;
  negative_marks: number;
  subject?: string;
  chapter?: string;
  order_index: number;
  attachment_url?: string;
  attachment_name?: string;
}

const resolveUrl = (url: string | undefined) => {
  if (!url) return '';
  return buildUrl(url);
};

interface AttemptData {
  attempt_id: string;
  assessment_id: string;
  questions: Question[];
  time_limit: number | null;
  started_at: string;
  responses?: Record<string, string> | null;
}

// ── Icons ──
const ClipboardIcon = () => (
  <svg className="w-10 h-10 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const WarningIcon = () => (
  <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

const XIcon = () => (
  <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// ── Modal Component ──
function Modal({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-scaleIn">
        {children}
      </div>
    </div>
  );
}

// ── Circular Timer ──
function CircularTimer({ timeLeft, totalTime }: { timeLeft: number; totalTime: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = totalTime > 0 ? timeLeft / totalTime : 1;
  const offset = circumference * (1 - progress);
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isCritical = timeLeft < 30;
  const isUrgent = timeLeft < 60 && !isCritical;
  const isWarning = timeLeft < 300 && !isUrgent && !isCritical;

  const strokeColor = isCritical ? '#dc2626' : isUrgent ? '#ef4444' : isWarning ? '#f59e0b' : '#6366f1';
  const textColor = isCritical ? 'text-red-700' : isUrgent ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-gray-900';

  return (
    <div className={`relative flex items-center justify-center ${
      isCritical ? 'animate-[shake_0.5s_ease-in-out_infinite]' : ''
    }`}>
      {/* Glow effect for critical time */}
      {isCritical && (
        <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
      )}
      <svg width="84" height="84" className="-rotate-90">
        <circle cx="42" cy="42" r={radius} fill="none" stroke={isCritical ? '#fecaca' : '#e5e7eb'} strokeWidth="4" />
        <circle
          cx="42" cy="42" r={radius} fill="none"
          stroke={strokeColor}
          strokeWidth={isCritical ? '5' : '4'} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className={`absolute text-center ${isCritical ? 'animate-pulse' : isUrgent ? 'animate-pulse' : ''}`}>
        <span className={`text-lg font-bold font-mono ${textColor}`}>
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
        {(isCritical || isUrgent) && (
          <p className="text-[9px] text-red-500 font-semibold">HURRY!</p>
        )}
      </div>
    </div>
  );
}

export default function TakeAssessmentPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const isPopup = searchParams.get('popup') === '1';

  const [pageState, setPageState] = useState<PageState>('loading');
  const [info, setInfo] = useState<AssessmentInfo | null>(null);
  const [attempt, setAttempt] = useState<AttemptData | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [totalTime, setTotalTime] = useState<number>(0);
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [questionStatuses, setQuestionStatuses] = useState<Record<string, QuestionStatus>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Set<number>>(new Set([0]));
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showTabWarning, setShowTabWarning] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const responsesRef = useRef(responses);
  const doSubmitRef = useRef<() => void>(() => {});
  const tabSwitchRef = useRef(0);
  const autoSubmitReasonRef = useRef<string | null>(null);
  const submittedRef = useRef(false);
  // When our own modals are open, suppress violation detection
  const suppressViolationsRef = useRef(false);
  const MAX_TAB_SWITCHES = 3;

  // Keep refs in sync
  useEffect(() => { responsesRef.current = responses; }, [responses]);


  // Fetch assessment info
  useEffect(() => {
    if (!token) {
      setErrorMsg('No assessment token provided.');
      setPageState('error');
      return;
    }

    // ── Demo mode: serve from sample data, skip backend ──
    if (isDemoToken(token)) {
      const testId = token.replace(/^demo-/, '');
      const test = SAMPLE_TESTS.find(t => t.test_id === testId);
      if (!test) {
        setErrorMsg('Sample test not found in demo data.');
        setPageState('error');
        return;
      }
      const course = SAMPLE_COURSES.find(c => c.course_id === test.course_id);
      setInfo({
        assessment_title: test.name,
        mode: test.mode === 'mock' ? 'exam' : 'practice',
        question_count: Math.min(test.question_count, 15), // cap demo to 15 questions
        time_limit: test.time_limit_min * 60,
        negative_marking: test.negative_marking,
        due_date: null,
        max_attempts: test.mode === 'practice' ? 3 : 1,
        attempts_used: 0,
        can_attempt: true,
        invitation_status: 'pending',
        email: 'demo@fgil-learn.com',
        organization_name: course?.name || 'FGIL CA Academy',
      });
      setPageState('landing');
      return;
    }

    fetch(`${API_BASE}/public/assessment/${token}`)
      .then(r => {
        if (!r.ok) throw new Error('Invalid or expired assessment link');
        return r.json();
      })
      .then((data: AssessmentInfo) => {
        setInfo(data);
        setPageState('landing');
      })
      .catch(e => {
        setErrorMsg(e.message || 'Failed to load assessment');
        setPageState('error');
      });
  }, [token]);

  // Timer
  useEffect(() => {
    if (!attempt || timeLeft == null || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev == null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          autoSubmitReasonRef.current = 'time_expired';
          doSubmitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [attempt?.attempt_id]);

  // Tab visibility + window blur + fullscreen detection
  useEffect(() => {
    if (pageState !== 'active') return;

    // Debounce flag to prevent multiple violations from the same user action
    // (e.g., visibilitychange + blur both fire on a single tab switch)
    let violationCooldown = false;

    const recordViolation = () => {
      // Don't count violations when our own system dialogs are showing
      if (suppressViolationsRef.current) return;
      if (submittedRef.current) return;
      // Prevent double-counting from simultaneous events
      if (violationCooldown) return;
      violationCooldown = true;
      setTimeout(() => { violationCooldown = false; }, 500);

      // Update ref immediately so beacon/auto-submit has correct count
      tabSwitchRef.current += 1;
      const newCount = tabSwitchRef.current;
      setTabSwitchCount(newCount);
      if (newCount >= MAX_TAB_SWITCHES) {
        autoSubmitReasonRef.current = 'tab_violations';
        doSubmitRef.current();
      } else {
        setShowTabWarning(true);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Delay to allow beforeunload to set suppression flag first
        // (browser X click causes blur → beforeunload in quick succession)
        setTimeout(() => recordViolation(), 300);
      }
    };

    const handleWindowBlur = () => {
      // Only count if document is still visible (alt-tab, taskbar click, etc.)
      // If document is hidden, visibilitychange already handles it
      setTimeout(() => {
        if (!document.hidden) {
          recordViolation();
        }
      }, 300);
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !submittedRef.current && !suppressViolationsRef.current) {
        recordViolation();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [pageState]);

  // Prevent browser close on landing page (popup mode) — show native "Leave site?" dialog
  useEffect(() => {
    if (!isPopup || pageState !== 'landing') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      (e as any).returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.onbeforeunload = handleBeforeUnload;
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.onbeforeunload = null;
    };
  }, [isPopup, pageState]);

  // Prevent close/reload + beacon submit on browser close (active exam)
  useEffect(() => {
    if (pageState !== 'active' || !attempt) return;

    const beaconUrl = `${API_BASE}/public/assessment/${token}/attempt/${attempt.attempt_id}/beacon-submit`;

    const fireBeacon = () => {
      if (submittedRef.current) return;
      if (isDemoToken(token)) return; // demo mode — nothing to send
      const payload = JSON.stringify({
        responses: responsesRef.current,
        metadata: {
          tab_violations: tabSwitchRef.current,
          auto_submitted: true,
          submit_reason: 'browser_close',
        },
      });
      navigator.sendBeacon(beaconUrl, new Blob([payload], { type: 'application/json' }));
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (submittedRef.current) return;
      // Suppress violations — browser close should NOT count as a tab violation
      suppressViolationsRef.current = true;
      // Do NOT fire beacon here — wait for pagehide (when user actually leaves).
      // Firing here would submit the exam even if user clicks "Stay" on the native dialog.
      // Show native confirm dialog to give user a chance to stay
      e.preventDefault();
      (e as any).returnValue = '';
      // Show our custom dialog too — if the user clicks "Stay" on the native dialog,
      // they'll see our custom confirmation dialog waiting for them
      setShowCloseConfirm(true);
      // If user stays (clicks "Stay/Cancel" on browser dialog), re-enable violation detection after a short delay
      setTimeout(() => { suppressViolationsRef.current = false; }, 2000);
      return '';
    };

    const handlePageHide = (e: PageTransitionEvent) => {
      // Fire beacon ONLY when the page is actually unloading (user confirmed leave or force-closed)
      if (!e.persisted) fireBeacon();
    };

    // Also handle unload as a fallback — some browsers don't fire pagehide reliably
    const handleUnload = () => {
      fireBeacon();
    };

    // Intercept keyboard shortcuts that close the browser/tab (Ctrl+W, Alt+F4)
    // Show our custom confirmation dialog instead of letting the browser close immediately
    const handleKeyDown = (e: KeyboardEvent) => {
      if (submittedRef.current) return;
      const isCtrlW = (e.ctrlKey || e.metaKey) && e.key === 'w';
      const isAltF4 = e.altKey && e.key === 'F4';
      const isCtrlF4 = (e.ctrlKey || e.metaKey) && e.key === 'F4';
      if (isCtrlW || isAltF4 || isCtrlF4) {
        e.preventDefault();
        e.stopPropagation();
        // Suppress violations — keyboard close should NOT count as a tab violation
        suppressViolationsRef.current = true;
        setShowCloseConfirm(true);
        setTimeout(() => { suppressViolationsRef.current = false; }, 2000);
      }
    };

    // Use both addEventListener and direct assignment for maximum browser compatibility
    // (some browsers/popup windows only respect one method)
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.onbeforeunload = handleBeforeUnload;
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('unload', handleUnload);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.onbeforeunload = null;
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('unload', handleUnload);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [pageState, attempt?.attempt_id, token]);

  // Periodic auto-save every 30 seconds (skip for demo tokens)
  useEffect(() => {
    if (pageState !== 'active' || !attempt) return;
    if (isDemoToken(token)) return;
    const interval = setInterval(() => {
      if (submittedRef.current) return;
      fetch(`${API_BASE}/public/assessment/${token}/attempt/${attempt.attempt_id}/autosave`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: responsesRef.current }),
      }).catch(() => {}); // silent fail — best effort
    }, 30000);
    return () => clearInterval(interval);
  }, [pageState, attempt?.attempt_id, token]);

  // Prevent right-click and copy during exam
  useEffect(() => {
    if (pageState !== 'active' || info?.mode !== 'exam') return;
    const preventContext = (e: MouseEvent) => e.preventDefault();
    const preventCopy = (e: ClipboardEvent) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'u', 'a'].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
    };
    document.addEventListener('contextmenu', preventContext);
    document.addEventListener('copy', preventCopy);
    document.addEventListener('keydown', preventKeys);
    return () => {
      document.removeEventListener('contextmenu', preventContext);
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('keydown', preventKeys);
    };
  }, [pageState, info?.mode]);

  const doStart = async () => {
    try {
      // ── Demo mode: build an attempt locally from sample questions ──
      if (isDemoToken(token) && info) {
        const questions: Question[] = generateDemoQuestions(info.question_count || 10);
        const data: AttemptData = {
          attempt_id: 'demo-attempt-' + Date.now(),
          assessment_id: token.replace(/^demo-/, ''),
          questions,
          time_limit: info.time_limit,
          started_at: new Date().toISOString(),
          responses: null,
        };
        setAttempt(data);
        if (data.time_limit) {
          setTimeLeft(data.time_limit);
          setTotalTime(data.time_limit);
        }
        const statuses: Record<string, QuestionStatus> = {};
        data.questions.forEach((q, i) => {
          statuses[q.id] = i === 0 ? 'not_answered' : 'not_visited';
        });
        setQuestionStatuses(statuses);
        setPageState('active');
        if (info?.mode === 'exam') {
          try { await document.documentElement.requestFullscreen(); } catch {}
        }
        return;
      }

      const res = await fetch(`${API_BASE}/public/assessment/${token}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to start assessment');
      }
      const data: AttemptData = await res.json();
      setAttempt(data);
      if (data.time_limit) {
        // On resume, calculate remaining time from started_at
        if (data.responses && Object.keys(data.responses).length > 0) {
          const elapsed = Math.floor((Date.now() - new Date(data.started_at).getTime()) / 1000);
          const remaining = Math.max(0, data.time_limit - elapsed);
          setTimeLeft(remaining);
        } else {
          setTimeLeft(data.time_limit);
        }
        setTotalTime(data.time_limit);
      }
      // Restore saved responses on resume
      if (data.responses && Object.keys(data.responses).length > 0) {
        setResponses(data.responses);
      }
      const statuses: Record<string, QuestionStatus> = {};
      data.questions.forEach((q, i) => {
        const hasAnswer = data.responses && data.responses[q.id];
        statuses[q.id] = hasAnswer ? 'answered' : (i === 0 ? 'not_answered' : 'not_visited');
      });
      setQuestionStatuses(statuses);
      setPageState('active');
      // Request fullscreen for exam mode
      if (info?.mode === 'exam') {
        try { await document.documentElement.requestFullscreen(); } catch {}
      }
    } catch (e: any) {
      setErrorMsg(e.message);
      setPageState('error');
    }
  };

  const handleStart = () => {
    // Open a new browser window for the exam
    const w = window.screen.width;
    const h = window.screen.height;
    const popupUrl = `${window.location.pathname}?token=${token}&popup=1`;
    const newWin = window.open(
      popupUrl,
      '_blank',
      `width=${w},height=${h},top=0,left=0,toolbar=no,menubar=no,scrollbars=yes,resizable=yes,location=no,status=no`
    );
    if (newWin) {
      // Replace landing page with a "test opened" message
      setPageState('error');
      setErrorMsg('Your assessment has been opened in a new window. You can close this tab.');
    } else {
      // Popup blocked — start in same tab
      doStart();
    }
  };

  // Auto-start when opened as popup
  useEffect(() => {
    if (isPopup && pageState === 'landing' && info?.can_attempt) {
      doStart();
    }
  }, [isPopup, pageState, info?.can_attempt]);

  const doSubmit = useCallback(async () => {
    if (!attempt || submittedRef.current) return;
    submittedRef.current = true;
    setPageState('submitting');
    if (timerRef.current) clearInterval(timerRef.current);

    // ── Demo mode: simulate a 600 ms submit and bump attempts_used locally ──
    if (isDemoToken(token)) {
      await new Promise(r => setTimeout(r, 600));
      if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch {}
      }
      setInfo(prev =>
        prev
          ? { ...prev, attempts_used: prev.attempts_used + 1, can_attempt: prev.attempts_used + 1 < (prev.max_attempts ?? 1) }
          : prev,
      );
      setPageState('submitted');
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/public/assessment/${token}/attempt/${attempt.attempt_id}/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            responses: responsesRef.current,
            metadata: {
              tab_violations: tabSwitchRef.current,
              auto_submitted: !!autoSubmitReasonRef.current,
              submit_reason: autoSubmitReasonRef.current || 'manual',
            },
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to submit');
      }
      // Exit fullscreen after submit
      if (document.fullscreenElement) {
        try { await document.exitFullscreen(); } catch {}
      }
      // Re-fetch assessment info so attempts_used is up-to-date for retake check
      try {
        const infoRes = await fetch(`${API_BASE}/public/assessment/${token}`);
        if (infoRes.ok) {
          const freshInfo: AssessmentInfo = await infoRes.json();
          setInfo(freshInfo);
        }
      } catch {}
      setPageState('submitted');
    } catch (e: any) {
      submittedRef.current = false; // allow retry
      setErrorMsg(e.message);
      setPageState('error');
    }
  }, [attempt, token]);

  // Keep submit ref in sync so event handlers always call latest version
  useEffect(() => { doSubmitRef.current = doSubmit; }, [doSubmit]);

  const handleSubmit = () => setShowSubmitModal(true);

  const confirmSubmit = () => {
    setShowSubmitModal(false);
    doSubmit();
  };

  const handleRetake = () => {
    setAttempt(null);
    setResponses({});
    setCurrentQ(0);
    setTimeLeft(null);
    setTotalTime(0);
    setQuestionStatuses({});
    setVisitedQuestions(new Set([0]));
    setTabSwitchCount(0);
    // Reset all refs so violations and submit state don't carry over from previous attempt
    tabSwitchRef.current = 0;
    submittedRef.current = false;
    autoSubmitReasonRef.current = null;
    suppressViolationsRef.current = false;
    if (isDemoToken(token)) {
      setPageState(info?.can_attempt ?? true ? 'landing' : 'error');
      if (info && !info.can_attempt) setErrorMsg('Maximum attempts reached');
      return;
    }
    fetch(`${API_BASE}/public/assessment/${token}`)
      .then(r => r.json())
      .then((data: AssessmentInfo) => {
        setInfo(data);
        setPageState(data.can_attempt ? 'landing' : 'error');
        if (!data.can_attempt) setErrorMsg('Maximum attempts reached');
      });
  };

  const setAnswer = (qId: string, value: string) => {
    setResponses(prev => ({ ...prev, [qId]: value }));
    setQuestionStatuses(prev => ({
      ...prev,
      [qId]: prev[qId] === 'marked_review' || prev[qId] === 'answered_marked'
        ? (value.trim() ? 'answered_marked' : 'marked_review')
        : (value.trim() ? 'answered' : 'not_answered'),
    }));
  };

  const clearResponse = (qId: string) => {
    setResponses(prev => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
    setQuestionStatuses(prev => ({
      ...prev,
      [qId]: prev[qId] === 'answered_marked' ? 'marked_review' : 'not_answered',
    }));
  };

  const markForReview = (qId: string) => {
    setQuestionStatuses(prev => {
      const current = prev[qId];
      if (current === 'marked_review') return { ...prev, [qId]: 'not_answered' };
      if (current === 'answered_marked') return { ...prev, [qId]: 'answered' };
      if (current === 'answered') return { ...prev, [qId]: 'answered_marked' };
      return { ...prev, [qId]: 'marked_review' };
    });
  };

  const navigateQuestion = (index: number) => {
    setCurrentQ(index);
    setVisitedQuestions(prev => new Set(prev).add(index));
    const q = attempt?.questions.sort((a, b) => a.order_index - b.order_index)[index];
    if (q && questionStatuses[q.id] === 'not_visited') {
      setQuestionStatuses(prev => ({ ...prev, [q.id]: 'not_answered' }));
    }
  };

  const saveAndNext = () => {
    if (!attempt) return;
    const questions = attempt.questions.sort((a, b) => a.order_index - b.order_index);
    if (currentQ < questions.length - 1) navigateQuestion(currentQ + 1);
  };

  const saveAndMarkReview = () => {
    if (!attempt) return;
    const questions = attempt.questions.sort((a, b) => a.order_index - b.order_index);
    const q = questions[currentQ];
    markForReview(q.id);
    if (currentQ < questions.length - 1) navigateQuestion(currentQ + 1);
  };

  // Status colors and labels
  const STATUS_CONFIG: Record<QuestionStatus, { bg: string; border: string; text: string; label: string }> = {
    not_visited: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-500', label: 'Not Visited' },
    not_answered: { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-600', label: 'Not Answered' },
    answered: { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white', label: 'Answered' },
    marked_review: { bg: 'bg-amber-400', border: 'border-amber-500', text: 'text-white', label: 'Marked for Review' },
    answered_marked: { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-white', label: 'Answered & Marked' },
  };

  const getStatusCounts = () => {
    const counts: Record<QuestionStatus, number> = {
      not_visited: 0, not_answered: 0, answered: 0, marked_review: 0, answered_marked: 0,
    };
    Object.values(questionStatuses).forEach(s => counts[s]++);
    return counts;
  };

  // ── Question Renderer ──
  const renderQuestion = (q: Question) => {
    const answer = responses[q.id] || '';
    const status = questionStatuses[q.id] || 'not_visited';
    const isReview = status === 'marked_review' || status === 'answered_marked';

    return (
      <div key={q.id} className="animate-fadeIn">
        {/* Question header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-sm font-bold shadow-md">
            {currentQ + 1}
          </div>
          <div className="flex-1">
            <p className="text-[15px] font-medium text-gray-900 leading-relaxed whitespace-pre-wrap">
              <MathText text={q.question_text} />
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-medium">
                {q.marks} mark{q.marks !== 1 ? 's' : ''}
              </span>
              {q.negative_marks > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-50 text-red-600 text-xs font-medium">
                  -{q.negative_marks} negative
                </span>
              )}
              {q.subject && (
                <span className="text-xs text-gray-400">{q.subject}</span>
              )}
              {isReview && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-medium">
                  Marked for Review
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Attachment image */}
        {q.attachment_url && (
          <div className="ml-0 sm:ml-14 mb-4">
            <img
              src={resolveUrl(q.attachment_url)}
              alt={q.attachment_name || 'Question attachment'}
              className="max-h-60 rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              onClick={(e) => {
                const img = e.currentTarget;
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                } else {
                  img.requestFullscreen?.();
                }
              }}
              title="Click to view full screen"
            />
            {q.attachment_name && (
              <p className="text-xs text-gray-400 mt-1">{q.attachment_name}</p>
            )}
          </div>
        )}

        {/* MCQ / True-False */}
        {(q.question_type === 'mcq' || q.question_type === 'true_false') && q.options && (
          <div className="space-y-2.5 ml-0 sm:ml-14">
            {Object.entries(q.options).map(([key, val], idx) => {
              const optionLabel = String.fromCharCode(65 + idx); // A, B, C, D
              const isSelected = answer === key;
              return (
                <button
                  key={key}
                  onClick={() => setAnswer(q.id, key)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-200 group ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm shadow-indigo-100'
                      : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                  }`}
                >
                  <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-200 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-indigo-100 group-hover:text-indigo-600'
                  }`}>
                    {optionLabel}
                  </span>
                  <span className={`text-sm ${isSelected ? 'text-indigo-900 font-medium' : 'text-gray-700'}`}>
                    <MathText text={String(val)} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Fill in the blank / Short answer */}
        {(q.question_type === 'fill' || q.question_type === 'short') && (
          <div className="ml-0 sm:ml-14">
            <input
              type="text"
              value={answer}
              onChange={e => setAnswer(q.id, e.target.value)}
              placeholder="Type your answer here..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
            />
          </div>
        )}

        {/* Long answer */}
        {q.question_type === 'long' && (
          <div className="ml-0 sm:ml-14">
            <textarea
              value={answer}
              onChange={e => setAnswer(q.id, e.target.value)}
              placeholder="Type your detailed answer here..."
              rows={6}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y transition-all text-sm"
            />
          </div>
        )}

        {/* Match the following */}
        {q.question_type === 'match' && q.options?.pairs && (
          <div className="ml-0 sm:ml-14 space-y-2.5">
            {(q.options.pairs as any[]).map((pair: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-sm font-medium w-36 truncate text-gray-700 bg-gray-50 px-3 py-2 rounded-lg"><MathText text={pair.left || pair.a} /></span>
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                <input
                  type="text"
                  value={(responses[q.id] || '').split(',')[idx] || ''}
                  onChange={e => {
                    const parts = (responses[q.id] || '').split(',');
                    while (parts.length <= idx) parts.push('');
                    parts[idx] = e.target.value;
                    setAnswer(q.id, parts.join(','));
                  }}
                  placeholder={`Match for ${pair.left || pair.a}`}
                  className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
            ))}
          </div>
        )}

        {/* Action buttons below question */}
        <div className="flex flex-wrap items-center gap-2 mt-6 ml-0 sm:ml-14">
          {answer && (
            <button
              onClick={() => clearResponse(q.id)}
              className="px-4 py-2 rounded-lg border-2 border-red-300 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
            >
              Clear Response
            </button>
          )}
          <button
            onClick={() => saveAndMarkReview()}
            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
              isReview
                ? 'border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100'
                : 'border-amber-300 text-amber-600 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            {isReview ? 'Unmark Review & Next' : 'Mark for Review & Next'}
          </button>
        </div>
      </div>
    );
  };

  // ── LOADING ──
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
          </div>
          <p className="text-gray-600 font-medium">Loading assessment...</p>
        </div>
      </div>
    );
  }

  // ── ERROR ──
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <XIcon />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Assessment</h2>
          <p className="text-gray-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  // ── LANDING ──
  if (pageState === 'landing' && info) {
    const formatDueDate = (d: string) => {
      const date = new Date(d);
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ', ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    return (
      <div className="h-screen bg-gradient-to-br from-slate-50 to-indigo-50 overflow-y-auto py-8 px-4 flex items-start justify-center">
        <div className="bg-white rounded-2xl shadow-lg border p-8 max-w-lg w-full animate-scaleIn">
          <div className="text-center mb-8">
            {info.organization_name && (
              <p className="text-sm font-semibold text-indigo-600 mb-3 tracking-wide uppercase">{info.organization_name}</p>
            )}
            <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
              <ClipboardIcon />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{info.assessment_title}</h1>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
              info.mode === 'exam'
                ? 'bg-red-50 text-red-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}>
              {info.mode} Mode
            </span>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
            {info.question_count != null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Total Questions</span>
                <span className="font-semibold text-gray-900">{info.question_count}</span>
              </div>
            )}
            {info.time_limit != null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Time Limit</span>
                <span className="font-semibold text-gray-900">{Math.round(info.time_limit / 60)} minutes</span>
              </div>
            )}
            {info.negative_marking && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Negative Marking</span>
                <span className="font-semibold text-red-600">Yes</span>
              </div>
            )}
            {info.due_date && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Due Date</span>
                <span className="font-semibold text-gray-900">{formatDueDate(info.due_date)}</span>
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6">
            <div className="flex gap-2 items-start">
              <WarningIcon />
              <div className="text-xs text-amber-800 leading-relaxed">
                <strong>Important:</strong> Do not switch tabs or leave this page during the assessment.
                You will receive warnings for tab switching. After {MAX_TAB_SWITCHES} violations, your assessment will be auto-submitted.
              </div>
            </div>
          </div>

          {!info.can_attempt ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center">
              <p className="text-gray-600 font-medium">
                {info.mode === 'exam' ? 'You have already taken this exam.' : 'Maximum attempts reached.'}
              </p>
            </div>
          ) : (
            <>
              <button
                onClick={handleStart}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
              >
                Start Assessment
              </button>
            </>
          )}

          <p className="text-xs text-gray-400 text-center mt-5">
            Taking as: <span className="font-medium">{info.email}</span>
          </p>
        </div>
      </div>
    );
  }

  // ── ACTIVE / SUBMITTING ──
  if ((pageState === 'active' || pageState === 'submitting') && attempt) {
    const questions = attempt.questions.sort((a, b) => a.order_index - b.order_index);
    const q = questions[currentQ];
    const counts = getStatusCounts();

    return (
      <div className="h-screen flex flex-col bg-gray-50 overflow-hidden select-none">
        {/* Top bar */}
        <header className="flex-shrink-0 bg-white border-b shadow-sm z-20">
          <div className="px-4 lg:px-6 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="min-w-0">
                {info?.organization_name && (
                  <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">{info.organization_name}</p>
                )}
                <h2 className="font-bold text-gray-900 text-sm truncate">{info?.assessment_title}</h2>
                <p className="text-xs text-gray-500">
                  Q {currentQ + 1} of {questions.length}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {timeLeft != null && (
                <CircularTimer timeLeft={timeLeft} totalTime={totalTime} />
              )}
              {tabSwitchCount > 0 && (
                <span className="hidden sm:inline-flex items-center px-2 py-1 rounded-lg bg-red-50 text-red-600 text-xs font-medium">
                  Violations: {tabSwitchCount}/{MAX_TAB_SWITCHES}
                </span>
              )}
              <button
                onClick={handleSubmit}
                disabled={pageState === 'submitting'}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-sm active:scale-[0.98]"
              >
                Submit
              </button>
              <button
                onClick={() => setShowCloseConfirm(true)}
                className="hidden sm:block p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                title="End & Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Question area */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6">
              <div className="bg-white rounded-2xl border shadow-sm p-4 sm:p-6 lg:p-8">
                {q && renderQuestion(q)}
              </div>

              {/* Bottom navigation */}
              <div className="flex items-center justify-between mt-4 pb-4">
                <button
                  onClick={() => navigateQuestion(Math.max(0, currentQ - 1))}
                  disabled={currentQ === 0}
                  className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl border-2 border-gray-200 text-xs sm:text-sm font-medium disabled:opacity-30 hover:bg-white hover:border-gray-300 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
                <button
                  onClick={saveAndNext}
                  disabled={currentQ >= questions.length - 1}
                  className="flex items-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-medium hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-sm active:scale-[0.98]"
                >
                  Save & Next
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </main>

          {/* Mobile sidebar backdrop */}
          {sidebarOpen && (
            <div
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/40 z-30"
              aria-hidden="true"
            />
          )}

          {/* Right sidebar — question palette */}
          <aside className={`flex-shrink-0 w-72 max-w-[85vw] bg-white border-l overflow-y-auto transition-transform duration-300 fixed lg:static inset-y-0 right-0 top-[58px] lg:top-0 z-40 ${
            sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}>
            <div className="p-4 space-y-4">
              {/* Profile section */}
              <div className="flex items-center gap-2 pb-3 border-b">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                  {(info?.email || '?')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{name || info?.email}</p>
                  {tabSwitchCount > 0 && (
                    <p className="text-[10px] text-red-500 font-medium">Violations: {tabSwitchCount}/{MAX_TAB_SWITCHES}</p>
                  )}
                </div>
              </div>

              {/* Summary counts */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                <div className="text-center py-2 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="text-xl font-bold text-emerald-700">{counts.answered + counts.answered_marked}</p>
                  <p className="text-[10px] font-medium text-emerald-600">Answered</p>
                </div>
                <div className="text-center py-2 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-xl font-bold text-slate-700">{counts.not_answered + counts.not_visited}</p>
                  <p className="text-[10px] font-medium text-slate-500">Remaining</p>
                </div>
                <div className="text-center py-2 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xl font-bold text-amber-700">{counts.marked_review + counts.answered_marked}</p>
                  <p className="text-[10px] font-medium text-amber-600">Review</p>
                </div>
              </div>

              {/* Legend */}
              <div className="bg-slate-50 rounded-xl p-2.5">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className={`w-4 h-4 rounded ${cfg.bg} ${cfg.border} border flex-shrink-0`} />
                      <span className="text-[10px] text-slate-600 truncate">{cfg.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Question grid */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Questions</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {questions.map((qItem, i) => {
                    const st = questionStatuses[qItem.id] || 'not_visited';
                    const cfg = STATUS_CONFIG[st];
                    const isCurrent = i === currentQ;
                    return (
                      <button
                        key={qItem.id}
                        onClick={() => navigateQuestion(i)}
                        className={`w-full aspect-square rounded-lg text-[11px] font-bold transition-all duration-150 border ${
                          isCurrent
                            ? 'ring-2 ring-indigo-500 ring-offset-1 scale-110 shadow-sm'
                            : 'hover:scale-105'
                        } ${cfg.bg} ${cfg.border} ${cfg.text}`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Submit confirmation modal */}
        <Modal open={showSubmitModal}>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Submit Assessment?</h3>
          <div className="space-y-2 mb-5">
            <div className="flex justify-between text-sm py-1.5 border-b">
              <span className="text-gray-500">Total Questions</span>
              <span className="font-semibold">{questions.length}</span>
            </div>
            <div className="flex justify-between text-sm py-1.5 border-b">
              <span className="text-green-600">Answered</span>
              <span className="font-semibold text-green-700">{counts.answered + counts.answered_marked}</span>
            </div>
            <div className="flex justify-between text-sm py-1.5 border-b">
              <span className="text-red-500">Not Answered</span>
              <span className="font-semibold text-red-600">{counts.not_answered + counts.not_visited}</span>
            </div>
            <div className="flex justify-between text-sm py-1.5">
              <span className="text-amber-500">Marked for Review</span>
              <span className="font-semibold text-amber-600">{counts.marked_review + counts.answered_marked}</span>
            </div>
          </div>
          {(counts.not_answered + counts.not_visited > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex gap-2 items-start">
              <WarningIcon />
              <p className="text-xs text-amber-800">
                You have <strong>{counts.not_answered + counts.not_visited}</strong> unanswered question(s).
                Are you sure you want to submit?
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setShowSubmitModal(false)}
              className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
            >
              Go Back
            </button>
            <button
              onClick={confirmSubmit}
              className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-all shadow-sm"
            >
              Confirm Submit
            </button>
          </div>
        </Modal>

        {/* Tab switch warning modal */}
        <Modal open={showTabWarning}>
          <div className="text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <WarningIcon />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Tab Switch Detected!</h3>
            <p className="text-sm text-gray-600 mb-2">
              You switched away from the assessment window. This has been recorded.
            </p>
            <p className="text-sm font-semibold text-red-600 mb-5">
              Warning {tabSwitchCount} of {MAX_TAB_SWITCHES}. Your assessment will be auto-submitted after {MAX_TAB_SWITCHES} violations.
            </p>
            <button
              onClick={() => setShowTabWarning(false)}
              className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-all"
            >
              I Understand, Continue Exam
            </button>
          </div>
        </Modal>

        {/* Close / End Exam confirmation modal */}
        <Modal open={showCloseConfirm}>
          <div className="text-center">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">End Assessment & Close?</h3>
            <p className="text-sm text-gray-600 mb-1">
              Are you sure you want to end your assessment?
            </p>
            <p className="text-sm text-gray-500 mb-5">
              Your current answers ({Object.keys(responses).length} of {questions.length} answered) will be submitted automatically and this window will close.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all"
              >
                Continue Assessment
              </button>
              <button
                onClick={() => {
                  setShowCloseConfirm(false);
                  autoSubmitReasonRef.current = 'manual_close';
                  doSubmit();
                }}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-all shadow-sm"
              >
                End & Submit
              </button>
            </div>
          </div>
        </Modal>
      </div>
    );
  }

  // ── SUBMITTED ──
  if (pageState === 'submitted') {
    const canRetake = info?.mode === 'practice' && (
      info.max_attempts == null || info.attempts_used < info.max_attempts
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border p-8 max-w-md w-full text-center animate-scaleIn">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckIcon />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Submitted Successfully!</h2>
          <p className="text-gray-500 mb-6">
            Your response has been recorded. Your teacher will review your answers.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-green-700 font-medium">
              Thank you for completing the assessment.
            </p>
          </div>
          {canRetake && (
            <button
              onClick={handleRetake}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
            >
              Retake Assessment
            </button>
          )}
          <p className="text-xs text-gray-400 mt-5">You may now safely close this window.</p>
        </div>
      </div>
    );
  }

  return null;
}
