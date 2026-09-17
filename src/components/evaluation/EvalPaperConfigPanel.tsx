import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Sparkles,
  Loader2,
  Plus,
  Info,
  ChevronLeft,
  ChevronRight,
  Check,
  BookOpen,
  Layers,
  ListChecks,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateWeightage, distributeEvenly } from '@/lib/distribution-utils';
import { WeightageEditor } from '@/components/personal-assessments/WeightageEditor';
import { EvalSubjectCard } from '@/components/evaluation/EvalSubjectCard';
import { useEvalSubjectSuggestions, useEvalChapterSuggestions } from '@/hooks/use-evaluation';
import type { EvalPaperConfig, EvalSubjectConfig } from '@/hooks/use-evaluation';
import { EXAMS } from '@/constants';
import { getSyllabusSubjects, getSyllabusChapters, getSyllabusSections } from '@/data/examSyllabus';
import { bilingualLanguageForExamType } from '@/config/tnpsc';

const MCQ_SUBTYPES = [
  { value: 'standard', label: 'Standard MCQ', description: 'Single-correct multiple choice.' },
  { value: 'case', label: 'Case-based MCQ', description: 'Scenario followed by linked MCQs.' },
  { value: 'assertion_reason', label: 'Assertion & Reason', description: 'Statement (A) + Reason (R), 4-option key.' },
  { value: 'higher_order', label: 'Higher Order Thinking', description: 'Analytical, multi-step reasoning.' },
];
const SUBTYPE_LABELS: Record<string, string> = Object.fromEntries(MCQ_SUBTYPES.map(s => [s.value, s.label]));

// Backend accepts 1–200 per generation run, so a full-length TNPSC paper
// (200 questions) can be generated in a single pass.
const MAX_QUESTIONS = 200;
const MAX_SUBJECTS = 10;

const STEPS = [
  { key: 'basics', label: 'Basics', icon: BookOpen },
  { key: 'subjects', label: 'Subjects', icon: Layers },
  { key: 'questions', label: 'Questions', icon: ListChecks },
  { key: 'review', label: 'Review', icon: Check },
] as const;
type StepKey = (typeof STEPS)[number]['key'];

interface EvalPaperConfigPanelProps {
  config: EvalPaperConfig;
  onChange: (config: EvalPaperConfig) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  generatingMessage?: string;
}

export function EvalPaperConfigPanel({ config, onChange, onGenerate, isGenerating, generatingMessage }: EvalPaperConfigPanelProps) {
  // Subject suggestions are generic for competitive exams — no grade/board filtering.
  const { data: subjectSuggestions = [] } = useEvalSubjectSuggestions();
  const [activeSubjectForChapters, setActiveSubjectForChapters] = useState<string | undefined>(
    config.subjects[0]?.subject || undefined,
  );
  const { data: chapterSuggestions = [] } = useEvalChapterSuggestions(activeSubjectForChapters);

  // Bilingual output is a Group 4 feature; null for Group 1 and non-TNPSC sets.
  const bilingualLanguage = bilingualLanguageForExamType(config.testType);

  // Merge the curated syllabus for the selected Test Type with any API suggestions.
  const mergedSubjectSuggestions = Array.from(
    new Set([...getSyllabusSubjects(config.testType), ...subjectSuggestions]),
  );
  const mergedChapterSuggestions = Array.from(
    new Set([...getSyllabusChapters(config.testType, activeSubjectForChapters), ...chapterSuggestions]),
  );

  const [step, setStep] = useState<StepKey>('basics');
  const stepIndex = STEPS.findIndex(s => s.key === step);

  // ── Mutations on the config ──
  const addSubject = () => {
    if (config.subjects.length >= MAX_SUBJECTS) return;
    const newSub: EvalSubjectConfig = {
      id: crypto.randomUUID(),
      subject: '',
      weightage: 100,
      sourceType: 'online',
      chapters: [],
    };
    const updated = [...config.subjects, newSub];
    const keys = updated.map(s => s.id);
    const weights = distributeEvenly(keys);
    const withWeights = updated.map(s => ({ ...s, weightage: weights[s.id] || 0 }));
    onChange({ ...config, subjects: withWeights });
  };

  // One-click populate the official sections for the selected Test Type,
  // weighted to match the real exam's section split (e.g. IBPS Clerk 30/35/35).
  const syllabusSections = getSyllabusSections(config.testType);
  const autoFillSections = () => {
    if (!syllabusSections.length) return;
    const total = syllabusSections.reduce((sum, s) => sum + (s.questions || 0), 0);
    const subjects: EvalSubjectConfig[] = syllabusSections.slice(0, MAX_SUBJECTS).map(sec => ({
      id: crypto.randomUUID(),
      subject: sec.subject,
      weightage: total ? Math.round(((sec.questions || 0) / total) * 100) : Math.round(100 / syllabusSections.length),
      sourceType: 'online',
      chapters: [],
    }));
    // Correct any rounding drift so weightage totals exactly 100.
    const sumW = subjects.reduce((sum, s) => sum + s.weightage, 0);
    if (subjects.length && sumW !== 100) subjects[0].weightage += 100 - sumW;
    onChange({ ...config, subjects, questionCount: total || config.questionCount });
  };

  const removeSubject = (id: string) => {
    const updated = config.subjects.filter(s => s.id !== id);
    if (updated.length > 0) {
      const keys = updated.map(s => s.id);
      const weights = distributeEvenly(keys);
      const withWeights = updated.map(s => ({ ...s, weightage: weights[s.id] || 0 }));
      onChange({ ...config, subjects: withWeights });
    }
  };

  const updateSubject = (id: string, sub: EvalSubjectConfig) => {
    onChange({ ...config, subjects: config.subjects.map(s => (s.id === id ? sub : s)) });
    if (sub.subject && sub.subject.length >= 2) {
      setActiveSubjectForChapters(sub.subject);
    }
  };

  const handleSubjectWeightageChange = (weights: Record<string, number>) => {
    onChange({
      ...config,
      subjects: config.subjects.map(s => ({ ...s, weightage: weights[s.id] || 0 })),
    });
  };

  const toggleMcqSubtype = (subtype: string) => {
    const current = config.mcqSubtypes || [];
    const next = current.includes(subtype) ? current.filter(s => s !== subtype) : [...current, subtype];
    if (next.length === 0) return;
    onChange({ ...config, mcqSubtypes: next });
  };

  // ── Validation ──
  const subjectsValid =
    config.subjects.length > 0 &&
    config.subjects.every(s => s.subject.trim()) &&
    (config.subjects.length < 2 ||
      validateWeightage(Object.fromEntries(config.subjects.map(s => [s.id, s.weightage]))).valid);

  const stepValidity: Record<StepKey, boolean> = {
    basics: !!config.title.trim(),
    subjects: subjectsValid,
    questions: (config.mcqSubtypes || []).length > 0 && config.questionCount > 0,
    review: true,
  };

  const canSubmit = stepValidity.basics && stepValidity.subjects && stepValidity.questions;

  const goNext = () => stepIndex < STEPS.length - 1 && setStep(STEPS[stepIndex + 1].key);
  const goPrev = () => stepIndex > 0 && setStep(STEPS[stepIndex - 1].key);

  return (
    <div className="max-w-6xl mx-auto py-2">
      {/* Page title */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          New Question Set
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
          Generate a new question set
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure subjects, scope, and question style. The AI will draft the set — you'll review before saving.
        </p>
      </div>

      {/* Stepper */}
      <Stepper steps={STEPS} currentIndex={stepIndex} validity={stepValidity} onStep={setStep} />

      {/* Wizard + Sidebar */}
      <div className="mt-6 grid lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Step card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          {step === 'basics' && (
            <StepShell number={1} title="Basic information" description="Give your question set a clear name and choose the overall difficulty.">
              <Field label="Question Set Title" required>
                <Input
                  value={config.title}
                  onChange={e => onChange({ ...config, title: e.target.value })}
                  placeholder="e.g. SSC CGL — Quantitative Aptitude Practice Set 1"
                  className="h-10"
                />
              </Field>

              <div className="grid grid-cols-2 gap-4 items-end">
                <Field label="Test Type" hint="Which competitive exam this set targets.">
                  <Select
                    value={config.testType || undefined}
                    onValueChange={v =>
                      onChange({
                        // Switching to an exam that isn't bilingual drops any translation
                        // setting rather than silently keeping one.
                        ...config,
                        testType: v,
                        secondaryLanguage: bilingualLanguageForExamType(v) ? config.secondaryLanguage : null,
                      })
                    }
                  >
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select test type…" /></SelectTrigger>
                    <SelectContent>
                      {EXAMS.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Difficulty" hint="Overall difficulty of the generated questions.">
                  <Select value={config.difficulty} onValueChange={v => onChange({ ...config, difficulty: v })}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4 items-end">
                <Field
                  label="Paper Language"
                  hint="Default for every section. A section named “General Tamil” generates in Tamil regardless."
                >
                  <Select
                    value={config.language ?? 'en'}
                    onValueChange={v => onChange({ ...config, language: v as 'ta' | 'en' })}
                  >
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="ta">Tamil / தமிழ்</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="Bilingual — repeat each question in"
                  hint={
                    bilingualLanguage
                      ? 'TNPSC objective papers are printed in both languages. Sections can override this.'
                      : 'This exam has no bilingual paper — the set stays single-language.'
                  }
                >
                  <Select
                    value={config.secondaryLanguage ?? 'none'}
                    disabled={!bilingualLanguage}
                    onValueChange={v =>
                      onChange({ ...config, secondaryLanguage: v === 'none' ? null : (v as 'ta' | 'en') })
                    }
                  >
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Single language</SelectItem>
                      {bilingualLanguage === 'ta' && <SelectItem value="ta">Tamil / தமிழ்</SelectItem>}
                      {bilingualLanguage === 'en' && <SelectItem value="en">English</SelectItem>}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </StepShell>
          )}

          {step === 'subjects' && (
            <StepShell
              number={2}
              title="Subjects"
              description={`Add up to ${MAX_SUBJECTS} subjects. For each, pick a source (Topics / Paste / File) and list the chapters to cover.`}
            >
              {syllabusSections.length > 0 && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    Set up the official <span className="font-medium text-foreground">{config.testType}</span> sections
                    ({syllabusSections.map(s => `${s.subject} ${s.questions ?? ''}`.trim()).join(' · ')}) in one click.
                  </p>
                  <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 text-xs" onClick={autoFillSections}>
                    <Sparkles className="h-3.5 w-3.5" /> Auto-fill sections
                  </Button>
                </div>
              )}

              {config.subjects.length === 0 && (
                <Alert className="bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Add at least one subject to generate questions.
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {config.subjects.map((sub, i) => (
                  <EvalSubjectCard
                    key={sub.id}
                    subject={sub}
                    index={i}
                    canRemove={config.subjects.length > 1}
                    subjectSuggestions={mergedSubjectSuggestions}
                    chapterSuggestions={mergedChapterSuggestions}
                    onChange={updated => updateSubject(sub.id, updated)}
                    onRemove={() => removeSubject(sub.id)}
                    bilingualLanguage={config.secondaryLanguage ? bilingualLanguage : null}
                  />
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs w-full"
                onClick={addSubject}
                disabled={config.subjects.length >= MAX_SUBJECTS}
              >
                <Plus className="h-3 w-3" /> Add Subject ({config.subjects.length}/{MAX_SUBJECTS})
              </Button>

              {config.subjects.length >= 2 && (
                <Field label="Subject Weightage" hint="How questions are distributed across the chosen subjects. Must total 100%.">
                  <WeightageEditor
                    items={config.subjects.map(s => ({
                      key: s.id,
                      label: s.subject || `Subject ${config.subjects.indexOf(s) + 1}`,
                    }))}
                    weights={Object.fromEntries(config.subjects.map(s => [s.id, s.weightage]))}
                    onChange={handleSubjectWeightageChange}
                  />
                </Field>
              )}
            </StepShell>
          )}

          {step === 'questions' && (
            <StepShell number={3} title="Question configuration" description="Choose how many questions to generate and which MCQ styles to include.">
              <Field
                label={`Question Count — ${config.questionCount} of ${MAX_QUESTIONS} max`}
                hint={
                  config.questionCount >= MAX_QUESTIONS
                    ? 'Reached the per-generation cap.'
                    : config.questionCount === 200
                    ? 'Full-length TNPSC paper.'
                    : undefined
                }
              >
                <Slider
                  value={[config.questionCount]}
                  onValueChange={([v]) => onChange({ ...config, questionCount: Math.min(v, MAX_QUESTIONS) })}
                  min={5}
                  max={MAX_QUESTIONS}
                  step={5}
                  className="mt-2"
                />
              </Field>

              <Field label="MCQ Question Style" hint="Pick one or more — questions will be distributed evenly across the selected styles.">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MCQ_SUBTYPES.map(sub => {
                    const checked = (config.mcqSubtypes || []).includes(sub.value);
                    return (
                      <label
                        key={sub.value}
                        className={cn(
                          'flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer transition-all',
                          checked
                            ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 ring-1 ring-indigo-500/30'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleMcqSubtype(sub.value)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <p className={cn('text-sm font-medium', checked ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200')}>
                            {sub.label}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sub.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </Field>
            </StepShell>
          )}

          {step === 'review' && (
            <StepShell number={4} title="Review" description="Confirm the configuration. Go back to edit anything before generating.">
              <ReviewSummary config={config} subtypeLabels={SUBTYPE_LABELS} />
              {!canSubmit && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p>Some required fields are missing. Go back and complete the highlighted steps before generating.</p>
                </div>
              )}
            </StepShell>
          )}

          {/* Nav bar */}
          <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-3 flex items-center justify-between bg-slate-50/60 dark:bg-slate-900/40 rounded-b-2xl">
            <Button variant="ghost" size="sm" onClick={goPrev} disabled={stepIndex === 0} className="gap-1.5">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Step {stepIndex + 1} of {STEPS.length}
            </p>
            {step !== 'review' ? (
              <Button size="sm" onClick={goNext} disabled={!stepValidity[step]} className="gap-1.5">
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex flex-col items-end gap-1">
                {isGenerating && generatingMessage && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-right max-w-[220px] truncate">
                    {generatingMessage}
                  </p>
                )}
                <Button size="sm" onClick={onGenerate} disabled={!canSubmit || isGenerating} className="gap-1.5">
                  {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {isGenerating ? 'Generating…' : 'Generate Question Set'}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Live summary sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-3">
              Question Set Summary
            </p>
            <LiveSummary config={config} subtypeLabels={SUBTYPE_LABELS} />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Stepper ───────────────────────────────────────────────────────────────

function Stepper({
  steps,
  currentIndex,
  validity,
  onStep,
}: {
  steps: readonly { key: StepKey; label: string; icon: any }[];
  currentIndex: number;
  validity: Record<StepKey, boolean>;
  onStep: (k: StepKey) => void;
}) {
  return (
    <ol className="flex items-center">
      {steps.map((s, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        const isReachable = i <= currentIndex || validity[steps[i - 1]?.key];
        const Icon = s.icon;
        return (
          <li key={s.key} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => isReachable && onStep(s.key)}
              disabled={!isReachable}
              className={cn(
                'group flex flex-col items-center gap-1.5 transition-colors',
                isReachable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all',
                  isCurrent && 'border-indigo-600 bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950/60',
                  isPast && 'border-indigo-600 bg-indigo-600 text-white',
                  !isCurrent && !isPast && 'border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500',
                )}
              >
                {isPast ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span
                className={cn(
                  'text-[11px] font-medium uppercase tracking-wider',
                  isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400',
                )}
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px mx-2 -mt-5">
                <div
                  className={cn(
                    'h-px w-full transition-colors',
                    i < currentIndex ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700',
                  )}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Step shell & field ────────────────────────────────────────────────────

function StepShell({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="p-6 sm:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        Step {number} of {STEPS.length}
      </p>
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">{title}</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">{description}</p>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1.5 block">
        {label}
        {required && <span className="text-rose-600 ml-0.5">*</span>}
      </Label>
      {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

// ─── Review summary (Step 4) ───────────────────────────────────────────────

function ReviewSummary({
  config,
  subtypeLabels,
}: {
  config: EvalPaperConfig;
  subtypeLabels: Record<string, string>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
      <SummaryRow label="Title" value={config.title || <em className="text-slate-400">Untitled</em>} />
      <SummaryRow label="Test Type" value={config.testType || <em className="text-slate-400">Not set</em>} />
      <SummaryRow label="Difficulty" value={<span className="capitalize">{config.difficulty}</span>} />
      <SummaryRow
        label="Subjects"
        value={
          config.subjects.length === 0 ? (
            <em className="text-slate-400">None added</em>
          ) : (
            <ul className="space-y-0.5">
              {config.subjects.map(s => {
                const count = config.subjects.length > 1 ? Math.round((config.questionCount * s.weightage) / 100) : config.questionCount;
                return (
                  <li key={s.id} className="flex items-baseline justify-between gap-3">
                    <span>
                      {s.subject || <em className="text-slate-400">Unnamed</em>}
                      {config.subjects.length > 1 && (
                        <span className="text-slate-400 ml-1 text-xs">· {s.weightage}%</span>
                      )}
                      {s.chapters.length > 0 && (
                        <span className="text-[11px] text-slate-500 ml-1">— {s.chapters.length} chapter{s.chapters.length === 1 ? '' : 's'}</span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500">{count} Q</span>
                  </li>
                );
              })}
            </ul>
          )
        }
      />
      <SummaryRow label="Questions" value={`${config.questionCount}`} />
      <SummaryRow
        label="MCQ Styles"
        value={
          (config.mcqSubtypes || []).length === 0 ? (
            <em className="text-slate-400">None selected</em>
          ) : (
            <ul className="space-y-0.5">
              {(config.mcqSubtypes || []).map(sub => (
                <li key={sub} className="flex items-baseline justify-between gap-3">
                  <span>{subtypeLabels[sub] || sub}</span>
                  <span className="text-xs text-slate-500">
                    {Math.round(config.questionCount / (config.mcqSubtypes?.length || 1))} Q
                  </span>
                </li>
              ))}
            </ul>
          )
        }
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-4 py-2.5 text-sm">
      <span className="text-slate-500 dark:text-slate-400 w-32 flex-shrink-0">{label}</span>
      <div className="flex-1 min-w-0 text-slate-900 dark:text-slate-100 font-medium">{value}</div>
    </div>
  );
}

// ─── Live summary (sidebar) ────────────────────────────────────────────────

function LiveSummary({
  config,
  subtypeLabels,
}: {
  config: EvalPaperConfig;
  subtypeLabels: Record<string, string>;
}) {
  const rows: { label: string; value: React.ReactNode; placeholder?: string }[] = [
    { label: 'Title', value: config.title || null, placeholder: 'Untitled' },
    { label: 'Test Type', value: config.testType || null, placeholder: 'Not set' },
    { label: 'Difficulty', value: <span className="capitalize">{config.difficulty}</span> },
    {
      label: 'Subjects',
      value: config.subjects.length > 0
        ? config.subjects.filter(s => s.subject).map(s => s.subject).join(', ') || `${config.subjects.length} draft`
        : null,
      placeholder: 'None added',
    },
    { label: 'Questions', value: `${config.questionCount}` },
    {
      label: 'MCQ Styles',
      value: (config.mcqSubtypes || []).length > 0
        ? (config.mcqSubtypes || []).map(s => subtypeLabels[s] || s).join(', ')
        : null,
      placeholder: 'None selected',
    },
  ];

  return (
    <div className="space-y-2.5 text-sm">
      {rows.map(r => (
        <div key={r.label} className="flex items-baseline justify-between gap-3">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 flex-shrink-0">
            {r.label}
          </span>
          <span
            className={cn(
              'text-right truncate',
              r.value ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-400 dark:text-slate-600 italic',
            )}
          >
            {r.value ?? r.placeholder ?? '—'}
          </span>
        </div>
      ))}
    </div>
  );
}
