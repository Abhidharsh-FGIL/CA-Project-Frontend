import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import { QuestionReviewPanel, type ReviewQuestion } from '@/components/personal-assessments/QuestionReviewPanel';
import { useSaveEvalPaper } from '@/hooks/use-evaluation';
import type { EvalPaperConfig } from '@/hooks/use-evaluation';
import { BASE_URL, getToken } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, BookOpen, Brain } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type JobStatus = 'running' | 'completed' | 'failed';

interface GenerationState {
  status: JobStatus;
  message: string;
  progress: { done: number; total: number };
  answerKeyJson: any[] | null;
  error: string | null;
  capped: boolean;
}

const ALL_STEPS = [
  { icon: BookOpen, label: 'Reading material', keywords: ['reading', 'studying', 'loading', 'document'], fileOnly: true },
  { icon: Brain,    label: 'Creating questions', keywords: ['generating', 'creating', 'question'], fileOnly: false },
];

function getSteps(hasFileSource: boolean) {
  return ALL_STEPS.filter(s => !s.fileOnly || hasFileSource);
}

function activeStepIndex(message: string, steps: typeof ALL_STEPS): number {
  const lower = message.toLowerCase();
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].keywords.some(k => lower.includes(k))) return i;
  }
  return 0;
}

function getStorageKey(jobId: string) {
  return `gen-config-${jobId}`;
}

export function EvalGeneratingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Config passed from config panel via router state, with sessionStorage fallback
  // so a page refresh doesn't lose it.
  const config: EvalPaperConfig | null = (() => {
    const fromState = (location.state as any)?.config as EvalPaperConfig | undefined;
    if (fromState) {
      if (jobId) sessionStorage.setItem(getStorageKey(jobId), JSON.stringify(fromState));
      return fromState;
    }
    if (jobId) {
      const saved = sessionStorage.getItem(getStorageKey(jobId));
      if (saved) return JSON.parse(saved) as EvalPaperConfig;
    }
    return null;
  })();

  const hasFileSource = config?.subjects.some(s => s.sourceType === 'file' || s.sourceType === 'text') ?? false;
  const steps = getSteps(hasFileSource);

  const savePaper = useSaveEvalPaper();

  const [genState, setGenState] = useState<GenerationState>({
    status: 'running',
    message: 'Starting generation…',
    progress: { done: 0, total: config?.questionCount ?? 0 },
    answerKeyJson: null,
    error: null,
    capped: false,
  });
  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestion[]>([]);

  useEffect(() => {
    if (!jobId) return;
    const token = getToken();
    if (!token) {
      navigate('/adminlogin', { replace: true });
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(
          `${BASE_URL}/api/v1/evaluation/papers/generate/stream/${jobId}`,
          {
            headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
            signal: controller.signal,
          },
        );

        if (!res.ok || !res.body) {
          setGenState(s => ({
            ...s, status: 'failed',
            message: 'Could not connect to server',
            error: `HTTP ${res.status}`,
          }));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop()!;

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));

              const nextStatus: JobStatus =
                data.status === 'completed' ? 'completed'
                : data.status === 'failed' ? 'failed'
                : 'running';

              setGenState(s => ({
                status: nextStatus,
                message: data.message || s.message,
                progress: data.progress || s.progress,
                answerKeyJson: data.answer_key_json ?? s.answerKeyJson,
                error: data.error ?? s.error,
                capped: data.capped ?? s.capped,
              }));

              if (data.status === 'completed' && Array.isArray(data.question_json)) {
                const answerKey: any[] = data.answer_key_json || [];
                const mapped: ReviewQuestion[] = data.question_json.map((q: any) => {
                  const ak = answerKey.find((a: any) => a.id === q.id);
                  return {
                    id: q.id,
                    type: q.type,
                    subtype: q.subtype,   // MCQ subtype from AI (e.g. 'standard', 'higher_order')
                    text: q.text,
                    options: q.options,
                    points: q.points || 1,
                    pairs: q.pairs,
                    correctAnswer: (() => {
                      if (!ak) return undefined;
                      if (q.type === 'mcq' && Array.isArray(q.options)) {
                        const idx = q.options.indexOf(ak.correctAnswer);
                        return idx >= 0 ? idx : ak.correctAnswer;
                      }
                      return ak.correctAnswer;
                    })(),
                    explanation: ak?.explanation,
                    subject: q.subject,
                    chapter: q.chapter,
                  };
                });
                setReviewQuestions(mapped);
                toast.success(`Generated ${mapped.length} question${mapped.length !== 1 ? 's' : ''}!`);
                if (data.capped) {
                  toast.info('Max 75 questions per generation — run another batch to add more.');
                }
              }
            } catch {
              // Ignore malformed events
            }
          }
        }
      } catch (e: any) {
        if (!controller.signal.aborted) {
          setGenState(s => ({
            ...s, status: 'failed',
            message: 'Connection error',
            error: e?.message || 'Unknown error',
          }));
        }
      }
    })();

    return () => controller.abort();
  }, [jobId, navigate]);

  const handleSave = async (questions: ReviewQuestion[]) => {
    if (!config) return;
    await savePaper.mutateAsync({
      config,
      questions: questions.map(q => ({
        ...q,
        subject: (q as any).subject || config.subjects[0]?.subject,
        chapter: (q as any).chapter,
      })),
      answerKey: genState.answerKeyJson || [],
    });
    if (jobId) sessionStorage.removeItem(getStorageKey(jobId));
    navigate('/org/evaluation', { state: { tab: 'papers' }, replace: true });
  };

  const handleBack = () => {
    if (jobId) sessionStorage.removeItem(getStorageKey(jobId));
    navigate('/org/evaluation', { state: { tab: 'create' } });
  };

  // ── Review panel after successful generation ──────────────────────────────
  if (genState.status === 'completed' && reviewQuestions.length > 0 && config) {
    return (
      <GenVerseShell>
        <QuestionReviewPanel
          questions={reviewQuestions}
          answerKey={genState.answerKeyJson || []}
          config={{
            title: config.title || 'Question Set',
            subject: config.subjects.map(s => s.subject).join(', '),
            difficulty: config.difficulty,
            mode: config.mode,
            timeLimitSeconds: config.timeLimitSeconds,
          }}
          onSaveDraft={handleSave}
          onTakeQuiz={() => {}}
          onBack={handleBack}
          isSaving={savePaper.isPending}
          saveLabel="Save"
          hideQuizButton
          mcqOnly
        />
      </GenVerseShell>
    );
  }

  // ── Progress / error view ─────────────────────────────────────────────────
  const pct =
    genState.progress.total > 0
      ? Math.round((genState.progress.done / genState.progress.total) * 100)
      : 0;
  const stepIdx = activeStepIndex(genState.message, steps);

  return (
    <GenVerseShell>
      <PageHeader
        title="Generating Question Set"
        description={
          config?.title ? `Preparing "${config.title}"` : 'AI is building your question paper…'
        }
        breadcrumbs={[
          { label: 'Admin', href: '/org/dashboard' },
          { label: 'Evaluation Hub', href: '/org/evaluation' },
          { label: 'Generating' },
        ]}
      />

      <div className="max-w-lg mx-auto mt-16 space-y-8">
        {genState.status === 'failed' ? (
          <div className="text-center space-y-5">
            <XCircle className="h-16 w-16 text-destructive mx-auto" />
            <div>
              <p className="text-lg font-semibold text-destructive">Generation Failed</p>
              <p className="text-sm text-muted-foreground mt-1">
                {genState.error || 'An unexpected error occurred.'}
              </p>
            </div>
            <Button onClick={handleBack}>Back to Configuration</Button>
          </div>
        ) : (
          <>
            {/* Animated step indicators */}
            <div className="space-y-2">
              {steps.map((step, i) => {
                const Icon = step.icon;
                const isDone = genState.status === 'completed' || i < stepIdx;
                const isActive = i === stepIdx && genState.status === 'running';
                return (
                  <div
                    key={step.label}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500',
                      isActive && 'bg-primary/5 border border-primary/20 shadow-sm',
                      isDone && 'opacity-50',
                    )}
                  >
                    <div
                      className={cn(
                        'h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors',
                        isDone
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : isActive
                          ? 'bg-primary/10'
                          : 'bg-muted',
                      )}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : isActive ? (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      ) : (
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        isActive ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            {genState.progress.total > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {genState.progress.done} of {genState.progress.total} questions
                  </span>
                  <span>{pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            )}

            {/* Live status message */}
            <p className="text-center text-sm text-muted-foreground">
              {genState.message}
            </p>
          </>
        )}
      </div>
    </GenVerseShell>
  );
}
