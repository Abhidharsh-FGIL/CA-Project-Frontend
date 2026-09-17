import { useState, useMemo, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Loader2,
  FileText,
  ChevronsUpDown,
  CalendarIcon,
  Globe,
  Upload,
  Type,
  ArrowLeft,
  Layers,
  Shuffle,
  ArrowDownUp,
  Check,
  ChevronRight,
  ChevronLeft,
  Clock,
  Sparkles,
  CalendarDays,
  Target,
  BookOpen,
  AlertCircle,
  IndianRupee,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEvalSubjectSuggestions, useEvalChapterSuggestions, useEvalPapers, useEvalQuestions } from '@/hooks/use-evaluation';
import { useCreateEvalAssessment, type EvalAssessmentConfig } from '@/hooks/use-eval-assessments';
import { WeightageEditor } from '@/components/personal-assessments/WeightageEditor';
import { distributeEvenly, distributeQuestions, validateWeightage } from '@/lib/distribution-utils';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { TnpscTagFields } from '@/components/evaluation/TnpscTagFields';
import { EMPTY_TAG, describeTag, examTypeLabel, tagAssessment, validateTnpscTag, type TnpscTagValue } from '@/lib/tnpscAdminApi';
import {
  hasPerSectionNegative,
  leastNegative,
  stageForExamType,
  type TnpscPatternSection,
} from '@/config/tnpsc';
import { findStage } from '@/config/tnpsc';

interface Props {
  onCreated: (assessmentId: string) => void;
  onBack?: () => void;
}

const STEPS = [
  { key: 'basics', label: 'Basics', icon: BookOpen },
  { key: 'content', label: 'Content', icon: Layers },
  { key: 'rules', label: 'Rules', icon: Target },
  { key: 'schedule', label: 'Schedule', icon: CalendarDays },
  { key: 'review', label: 'Review', icon: Check },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

export function EvalAssessmentConfigPanel({ onCreated, onBack }: Props) {
  const { profileContext } = useWorkspaceContext();
  const createAssessment = useCreateEvalAssessment();

  // ── Form state ──
  const [title, setTitle] = useState('');
  // TNPSC placement — decides where this paper appears in the aspirant portal.
  // `track` is driven by the assessment mode below, so it is not editable here.
  const [tnpscTag, setTnpscTag] = useState<TnpscTagValue>({ ...EMPTY_TAG, track: 'mock' });
  const [sourceType, setSourceType] = useState<'online' | 'text' | 'file' | 'all' | ''>('');
  const [source, setSource] = useState<'bank' | 'paper'>('bank');
  const [paperIds, setPaperIds] = useState<string[]>([]);
  const [paperWeights, setPaperWeights] = useState<Record<string, number>>({});
  const [difficulty, setDifficulty] = useState('medium');
  // Test type is no longer picked by hand — it follows the TNPSC placement below
  // (e.g. "TNPSC Group 1 Prelims"), which keeps it aligned with the syllabus keys
  // used by the question generator.
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [selectedTypes] = useState<string[]>(['mcq']);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [mode, setMode] = useState('exam');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | undefined>();
  const [negativeMarking, setNegativeMarking] = useState(false);
  /**
   * 'paper' applies one deduction everywhere; 'section' gives each section of the
   * exam pattern its own. Only offered when the pattern actually disagrees —
   * GAT-B takes 0.5 in Section A and 1 in Section B.
   */
  const [negativeScope, setNegativeScope] = useState<'paper' | 'section'>('paper');
  /** Deduction per section, keyed by section name. Seeded from the exam pattern. */
  const [sectionNegatives, setSectionNegatives] = useState<Record<string, number>>({});
  // Unified model: "for every {wrongs} wrong answer(s), deduct {deduction} mark(s)"
  const [negativeMarkWrongs, setNegativeMarkWrongs] = useState(1);
  const [negativeMarkDeduction, setNegativeMarkDeduction] = useState(0.25);
  // Derived for backward-compatible backend payload
  const negativeMarkMode: 'per_question' | 'per_group' = negativeMarkWrongs === 1 ? 'per_question' : 'per_group';

  // The exam pattern behind the chosen TNPSC/GAT-B placement, and whether its
  // sections are marked differently from one another.
  const examStage = stageForExamType(examTypeLabel(tnpscTag) ?? undefined);
  const examPattern = examStage?.pattern;
  const perSectionAvailable = hasPerSectionNegative(examPattern);
  const patternSections: TnpscPatternSection[] = examPattern?.sections ?? [];
  const usingPerSection = negativeMarking && negativeScope === 'section' && perSectionAvailable;

  // Seed the per-section values from the pattern the first time a paper whose
  // sections differ is placed, and default the scope to 'section' — that is the
  // correct setting for such a paper, and the one an admin would otherwise have to
  // know to go and find.
  useEffect(() => {
    if (!perSectionAvailable) {
      setNegativeScope('paper');
      return;
    }
    setSectionNegatives(prev => {
      const next = { ...prev };
      for (const sec of patternSections) {
        if (next[sec.name] == null) {
          next[sec.name] = sec.negative_mark_value ?? examPattern?.negative_mark_value ?? 0.25;
        }
      }
      return next;
    });
    setNegativeScope('section');
    setNegativeMarking(true);
    // Keyed on the placement, not the objects, so re-renders don't fight the admin's edits.
  }, [perSectionAvailable, examStage?.id]);
  const [maxAttempts, setMaxAttempts] = useState<number | undefined>();
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [subjectWeights, setSubjectWeights] = useState<Record<string, number>>({});
  // Pricing (mock test only)
  const [pricingType, setPricingType] = useState<'free' | 'paid'>('free');
  const [price, setPrice] = useState<number | undefined>();
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscountPct, setPromoDiscountPct] = useState<number | undefined>();

  // ── Wizard state ──
  const [step, setStep] = useState<StepKey>('basics');
  const stepIndex = STEPS.findIndex(s => s.key === step);

  const handleModeChange = (next: string) => {
    setMode(next);
    if (maxAttempts === undefined) {
      // TNPSC mocks stay retryable on purpose: with the level gate, a single failed
      // attempt on a one-shot mock would lock the aspirant out of every later level.
      setMaxAttempts(next === 'practice' ? 3 : 3);
    }
    // Mode is the track: "exam" → mock, "practice" → practice.
    setTnpscTag(t => ({
      ...t,
      track: next === 'practice' ? 'practice' : 'mock',
      level: next === 'practice' ? null : t.level ?? 'simple',
      subject_id: next === 'practice' ? t.subject_id : null,
      topic_id: next === 'practice' ? t.topic_id : null,
    }));
  };

  /** The exam pattern of the selected stage — drives the "apply pattern" shortcut. */
  const tnpscStage = findStage(tnpscTag.group_id ?? undefined, tnpscTag.stage_id ?? undefined)?.stage;
  const testType = examTypeLabel(tnpscTag) ?? '';

  const applyTnpscPattern = () => {
    const p = tnpscStage?.pattern;
    if (!p) return;
    setQuestionCount(p.total_questions);
    setTimeLimitMinutes(p.duration_minutes);
    setNegativeMarking(p.negative_marking);
    toast.success(`Applied ${tnpscStage!.short_name} pattern — ${p.total_questions} questions, ${p.duration_minutes} min.`);
  };

  // 'all' means no source filter
  const effectiveSourceFilter = sourceType && sourceType !== 'all' ? sourceType : undefined;

  const { data: papers = [] } = useEvalPapers(effectiveSourceFilter ? { sourceType: effectiveSourceFilter } : undefined);

  const subjectFilters = useMemo(() => ({
    sourceType: effectiveSourceFilter,
  }), [effectiveSourceFilter]);
  const { data: subjectSuggestions = [] } = useEvalSubjectSuggestions(subjectFilters);
  // Unfiltered — the source-type filter hides subjects that exist in the bank but
  // were ingested a different way, which left the picker showing four of them.
  const { data: allSubjectSuggestions = [] } = useEvalSubjectSuggestions();

  const activeSubject = selectedSubjects[0];
  const { data: chapterSuggestions = [] } = useEvalChapterSuggestions(activeSubject, effectiveSourceFilter);

  const bankFilters = useMemo(() => ({
    subject: selectedSubjects.length === 1 ? selectedSubjects[0] : undefined,
    difficulty: difficulty !== 'all' ? difficulty : undefined,
    source: effectiveSourceFilter,
  }), [selectedSubjects, difficulty, effectiveSourceFilter]);
  const { data: bankQuestions = [] } = useEvalQuestions(source === 'bank' && sourceType ? bankFilters : undefined);

  /**
   * Every subject the question bank actually holds: the unfiltered suggestion list,
   * whatever the source-filtered call returned, and any subject seen on a loaded
   * question. Already-selected subjects are kept even if a filter would now hide
   * them, so changing the source can't silently drop a choice.
   */
  const subjectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    const add = (value?: string) => {
      const label = (value ?? '').trim();
      if (!label) return;
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, label);
    };
    (allSubjectSuggestions as string[]).forEach(add);
    (subjectSuggestions as string[]).forEach(add);
    (bankQuestions as any[]).forEach(q => add(q?.subject));
    selectedSubjects.forEach(add);
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [allSubjectSuggestions, subjectSuggestions, bankQuestions, selectedSubjects]);

  const matchingQuestions = useMemo(() => {
    if (source === 'paper') return [];
    let qs = bankQuestions as any[];
    if (selectedSubjects.length > 1) {
      qs = qs.filter((q: any) => selectedSubjects.includes(q.subject));
    }
    if (selectedChapters.length > 0) {
      qs = qs.filter((q: any) => selectedChapters.includes(q.chapter));
    }
    if (selectedTypes.length > 0) {
      qs = qs.filter((q: any) => selectedTypes.includes(q.type));
    }
    return qs;
  }, [bankQuestions, selectedSubjects, selectedChapters, selectedTypes, source]);

  const toggleSubject = (s: string) => {
    setSelectedSubjects(prev => {
      const next = prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s];
      setSubjectWeights(next.length > 0 ? distributeEvenly(next) : {});
      return next;
    });
    setSelectedChapters([]);
  };

  const toggleChapter = (c: string) => {
    setSelectedChapters(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const subjectWeightsValid = useMemo(() => {
    if (selectedSubjects.length < 2) return true;
    return validateWeightage(subjectWeights).valid;
  }, [selectedSubjects, subjectWeights]);

  const togglePaper = (id: string) => {
    setPaperIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      setPaperWeights(next.length > 0 ? distributeEvenly(next) : {});
      return next;
    });
  };

  const paperWeightsValid = useMemo(() => {
    if (paperIds.length < 2) return true;
    return validateWeightage(paperWeights).valid;
  }, [paperIds, paperWeights]);

  const totalPaperQuestionCount = useMemo(() => {
    if (source !== 'paper') return 0;
    return paperIds.reduce((sum, id) => {
      const p = (papers as any[]).find((x: any) => x.id === id);
      return sum + (p?.question_count || 0);
    }, 0);
  }, [paperIds, papers, source]);

  const availableCount = source === 'paper'
    ? totalPaperQuestionCount
    : matchingQuestions.length;

  const effectiveCount = Math.min(questionCount, availableCount);

  // A paper with no stage/track never surfaces in the aspirant portal, so the
  // placement is part of step-1 validity rather than an optional extra.
  const tnpscValidation = validateTnpscTag(tnpscTag, effectiveCount || questionCount);

  // ── Per-step validity ──
  const stepValidity: Record<StepKey, boolean> = {
    basics: !!title.trim() && !!mode && tnpscValidation.ok,
    content:
      source === 'paper'
        ? paperIds.length > 0 && paperWeightsValid && effectiveCount > 0
        : !!sourceType && selectedSubjects.length > 0 && effectiveCount > 0 && subjectWeightsValid,
    rules: true,
    schedule: true,
    review: true,
  };

  const canSubmit =
    !!title.trim() &&
    tnpscValidation.ok &&
    effectiveCount > 0 &&
    (source === 'paper' ? paperIds.length > 0 && paperWeightsValid : selectedSubjects.length > 0 && subjectWeightsValid);

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1].key);
  };
  const goPrev = () => {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1].key);
  };

  // ── Submit ──
  const handleCreate = async () => {
    let qIds: string[] = [];
    let maxScore = 0;

    if (source === 'paper' && paperIds.length > 0) {
      if (shuffleQuestions) {
        // Shuffle: send ALL questions from each paper as the pool
        const allPaperQs: any[] = [];
        for (const pid of paperIds) {
          const paperQs = await api.get<any[]>(`/api/v1/evaluation/papers/${pid}/questions`);
          allPaperQs.push(...(paperQs || []));
        }
        qIds = allPaperQs.map((q: any) => q.id);
        const totalMarks = allPaperQs.reduce((s: number, q: any) => s + (q.points || 1), 0);
        maxScore = qIds.length > 0 ? Math.round((totalMarks / qIds.length) * effectiveCount * 100) / 100 : effectiveCount;
      } else {
        // Constant: pick fixed set per paper according to weightage
        const allocation = paperIds.length > 1
          ? distributeQuestions(effectiveCount, paperWeights)
          : { [paperIds[0]]: effectiveCount };
        const picked: any[] = [];
        for (const pid of paperIds) {
          const wanted = allocation[pid] || 0;
          if (wanted === 0) continue;
          const paperQs = await api.get<any[]>(`/api/v1/evaluation/papers/${pid}/questions`);
          picked.push(...(paperQs || []).slice(0, wanted));
        }
        qIds = picked.map((q: any) => q.id);
        maxScore = picked.reduce((s: number, q: any) => s + (q.points || 1), 0);
      }
    } else if (selectedSubjects.length > 1) {
      if (shuffleQuestions) {
        // Shuffle: send ALL matching questions as the pool
        qIds = (matchingQuestions as any[]).map((q: any) => q.id);
        const totalMarks = (matchingQuestions as any[]).reduce((s: number, q: any) => s + (q.points || 1), 0);
        maxScore = qIds.length > 0 ? Math.round((totalMarks / qIds.length) * effectiveCount * 100) / 100 : effectiveCount;
      } else {
        // Constant: fixed questions per subject according to weights
        const allocation = distributeQuestions(effectiveCount, subjectWeights);
        const picked: any[] = [];
        for (const subj of selectedSubjects) {
          const wanted = allocation[subj] || 0;
          if (wanted === 0) continue;
          const subjPool = (matchingQuestions as any[]).filter((q: any) => q.subject === subj);
          picked.push(...subjPool.slice(0, wanted));
        }
        qIds = picked.map((q: any) => q.id);
        maxScore = picked.reduce((s: number, q: any) => s + (q.points || 1), 0);
      }
    } else {
      if (shuffleQuestions) {
        // Shuffle: send ALL matching questions as the pool
        qIds = (matchingQuestions as any[]).map((q: any) => q.id);
        const totalMarks = (matchingQuestions as any[]).reduce((s: number, q: any) => s + (q.points || 1), 0);
        maxScore = qIds.length > 0 ? Math.round((totalMarks / qIds.length) * effectiveCount * 100) / 100 : effectiveCount;
      } else {
        // Constant: fixed set of effectiveCount questions
        const picked = matchingQuestions.slice(0, effectiveCount);
        qIds = picked.map((q: any) => q.id);
        maxScore = picked.reduce((s: number, q: any) => s + (q.points || 1), 0);
      }
    }

    if (qIds.length === 0) {
      toast.error('No questions available to create assessment');
      return;
    }

    // A paper that offers a choice cannot be scored by summing every question's
    // marks. GAT-B prints 160 questions worth 360 between them, but asks for 120
    // and is marked out of 240. When the paper matches its pattern exactly, the
    // pattern's own total is the truth; a partial paper keeps the computed sum,
    // since there is no way to know how the shortfall splits across sections.
    if (
      examPattern?.total_marks != null &&
      examPattern.total_questions === effectiveCount &&
      examPattern.sections.some(sec => sec.attempt != null && sec.attempt < sec.questions)
    ) {
      maxScore = examPattern.total_marks;
    }

    const result = await createAssessment.mutateAsync({
      title,
      testType: testType || undefined,
      // TNPSC placement — sent at create; also PATCHed below for backends that
      // don't yet accept the tags inline.
      tnpscStageId: tnpscTag.stage_id ?? undefined,
      track: tnpscTag.track ?? undefined,
      tnpscLevel: tnpscTag.track === 'mock' ? tnpscTag.level ?? undefined : undefined,
      tnpscSubjectId: tnpscTag.track === 'practice' ? tnpscTag.subject_id ?? undefined : undefined,
      tnpscTopicId: tnpscTag.track === 'practice' ? tnpscTag.topic_id ?? undefined : undefined,
      paperId: source === 'paper' && paperIds.length === 1 ? paperIds[0] : undefined,
      paperIds: source === 'paper' && paperIds.length > 1 ? paperIds : undefined,
      paperWeights: source === 'paper' && paperIds.length > 1 ? paperWeights : undefined,
      difficulty,
      questionIds: qIds,
      questionCount: effectiveCount,
      maxScore,
      dueDate: dueDate?.toISOString(),
      mode,
      timeLimitSeconds: mode === 'exam' && timeLimitMinutes ? timeLimitMinutes * 60 : undefined,
      negativeMarking,
      // With per-section marking the flat value still goes out, set to the *least*
      // punitive section, so a backend that ignores `negativeMarkSections` scores the
      // paper leniently rather than inventing lost marks. See GAT_B_BACKEND_CHANGES.md §6.
      negativeMarkValue: negativeMarking
        ? usingPerSection
          ? leastNegative({ ...examPattern!, sections: patternSections.map(sec => ({ ...sec, negative_mark_value: sectionNegatives[sec.name] })) })
          : negativeMarkDeduction
        : undefined,
      negativeMarkMode: negativeMarking ? negativeMarkMode : undefined,
      negativeMarkGroupSize: negativeMarking && negativeMarkMode === 'per_group' ? negativeMarkWrongs : undefined,
      negativeMarkSections: usingPerSection
        ? patternSections.map(sec => ({
            name: sec.name,
            subjectIds: sec.subject_ids,
            negativeMarkValue: sectionNegatives[sec.name],
            marksPerQuestion: sec.marks_per_question,
            questions: sec.questions,
            attempt: sec.attempt,
          }))
        : undefined,
      maxAttempts,
      shuffleQuestions,
      subjectWeights: source !== 'paper' && selectedSubjects.length > 1 ? subjectWeights : undefined,
      pricingType,
      price: pricingType === 'paid' ? price : undefined,
      promoCode: pricingType === 'paid' && promoCode.trim() ? promoCode.trim().toUpperCase() : undefined,
      promoDiscountPct: pricingType === 'paid' && promoCode.trim() ? promoDiscountPct : undefined,
    });

    // Confirm the TNPSC placement. Non-fatal: the assessment exists either way,
    // but until it is tagged it will not appear under any group/stage.
    try {
      await tagAssessment(result.id, tnpscTag);
    } catch (err: any) {
      toast.warning(
        `Assessment created, but the TNPSC placement (${describeTag(tnpscTag)}) could not be saved — ` +
          `tag it from the Assessments tab once PATCH /evaluation/assessments/{id}/tnpsc is available.`,
      );
    }

    onCreated(result.id);
  };

  return (
    <div className="max-w-6xl mx-auto py-2">
      {/* Top bar */}
      {onBack && (
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assessments
        </button>
      )}

      {/* Page title */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          New Assessment
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mt-1">
          Create a new test
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure the paper, scoring rules, and schedule. Complete each step in order.
        </p>
      </div>

      {/* Stepper */}
      <Stepper steps={STEPS} currentIndex={stepIndex} validity={stepValidity} onStep={k => setStep(k)} />

      {/* Wizard + Sidebar */}
      <div className="mt-6 grid lg:grid-cols-[1fr_320px] gap-5 items-start">

      {/* Step card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        {step === 'basics' && (
          <StepShell number={1} title="Basic information" description="Give your assessment a clear name and choose the mode students will sit it in.">
            <Field label="Assessment Title" required>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. SSC CGL — Tier 1 Full Mock"
                className="h-10"
              />
            </Field>

            <Field label="Assessment Mode">
              <div className="grid grid-cols-2 gap-3">
                <ModeCard
                  active={mode === 'exam'}
                  onClick={() => handleModeChange('exam')}
                  icon={<Clock className="h-4 w-4" />}
                  title="Mock test"
                />
                <ModeCard
                  active={mode === 'practice'}
                  onClick={() => handleModeChange('practice')}
                  icon={<Sparkles className="h-4 w-4" />}
                  title="Practice"
                />
              </div>
            </Field>

            <Field label="Default Difficulty">
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {/* TNPSC placement — required, decides where aspirants see this paper */}
            <Field
              label="TNPSC placement"
              required
              hint="Where this paper appears in the aspirant portal. Untagged papers stay invisible."
            >
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
                <TnpscTagFields
                  value={tnpscTag}
                  onChange={setTnpscTag}
                  questionCount={effectiveCount || questionCount}
                  hideTrack
                />
                {tnpscStage?.pattern && tnpscTag.track === 'mock' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={applyTnpscPattern}
                    className="mt-3 h-8 text-xs gap-1.5"
                  >
                    <Target className="h-3.5 w-3.5" />
                    Apply {tnpscStage.short_name} pattern — {tnpscStage.pattern.total_questions} Qs ·{' '}
                    {tnpscStage.pattern.duration_minutes} min
                  </Button>
                )}
              </div>
            </Field>
          </StepShell>
        )}

        {step === 'content' && (
          <StepShell number={2} title="Source & content" description="Pick where the questions come from and how many should be on the assessment.">
            {/* Source type */}
            <Field label="Question Source Type">
              <div className="grid grid-cols-4 gap-2">
                {([
                  { value: 'all' as const, label: 'All', icon: Layers },
                  { value: 'online' as const, label: 'Online', icon: Globe },
                  { value: 'text' as const, label: 'Text', icon: Type },
                  { value: 'file' as const, label: 'File', icon: Upload },
                ]).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setSourceType(opt.value);
                      setSource('bank');
                      setPaperIds([]);
                      setSelectedSubjects([]);
                      setSelectedChapters([]);
                    }}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition-all',
                      sourceType === opt.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 ring-1 ring-indigo-500/30'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                    )}
                  >
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            {sourceType && (
              <>
                <Field label="Question Pool">
                  <div className="grid grid-cols-2 gap-2">
                    <PoolButton active={source === 'bank'} onClick={() => setSource('bank')}>
                      Question Bank
                    </PoolButton>
                    <PoolButton active={source === 'paper'} onClick={() => setSource('paper')}>
                      From Collections
                    </PoolButton>
                  </div>
                </Field>

                {source === 'paper' ? (
                  <>
                    <Field label="Collections" required hint="Pick one or more saved collections to combine.">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-10 justify-between font-normal">
                            {paperIds.length > 0
                              ? `${paperIds.length} selected`
                              : 'Select collections…'}
                            <ChevronsUpDown className="h-4 w-4 ml-2 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-2 max-h-60 overflow-y-auto" align="start">
                          {(papers as any[]).filter((p: any) => p.title?.trim()).length === 0 ? (
                            <p className="text-xs text-slate-500 p-2">No collections found.</p>
                          ) : (
                            (papers as any[]).filter((p: any) => p.title?.trim()).map((p: any) => (
                              <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer text-sm">
                                <Checkbox checked={paperIds.includes(p.id)} onCheckedChange={() => togglePaper(p.id)} />
                                <span className="flex-1 truncate">{p.title}</span>
                                <span className="text-xs text-slate-400 flex-shrink-0">{p.question_count} Q</span>
                              </label>
                            ))
                          )}
                        </PopoverContent>
                      </Popover>
                      {paperIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {paperIds.map(id => {
                            const p = (papers as any[]).find((x: any) => x.id === id);
                            return p ? (
                              <Badge key={id} variant="secondary" className="text-xs">
                                {p.title} <span className="text-slate-400 ml-1">· {p.question_count} Q</span>
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </Field>

                    {paperIds.length >= 2 && (
                      <Field label="Collection Weightage" hint="How questions are distributed across the chosen collections. Must total 100%.">
                        <WeightageEditor
                          items={paperIds.map(id => {
                            const p = (papers as any[]).find((x: any) => x.id === id);
                            return { key: id, label: p?.title || id };
                          })}
                          weights={paperWeights}
                          onChange={setPaperWeights}
                        />
                      </Field>
                    )}

                    {paperIds.length > 0 && (
                      <Field
                        label={`Questions in this assessment — ${effectiveCount}`}
                        hint={`${totalPaperQuestionCount} question${totalPaperQuestionCount === 1 ? '' : 's'} available across the ${paperIds.length} selected collection${paperIds.length === 1 ? '' : 's'}`}
                      >
                        <Slider
                          value={[questionCount]}
                          onValueChange={([v]) => setQuestionCount(v)}
                          min={1}
                          max={Math.max(totalPaperQuestionCount, 1)}
                          step={1}
                          className="mt-2"
                        />
                      </Field>
                    )}
                  </>
                ) : (
                  <>
                    <Field label="Subjects" required>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-10 justify-between font-normal">
                            {selectedSubjects.length > 0
                              ? `${selectedSubjects.length} selected`
                              : 'Select subjects…'}
                            <ChevronsUpDown className="h-4 w-4 ml-2 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-2 max-h-60 overflow-y-auto" align="start">
                          {subjectOptions.length === 0 ? (
                            <p className="text-xs text-slate-500 p-2">
                              No subjects in the question bank yet — generate or import a paper first.
                            </p>
                          ) : (
                            subjectOptions.map((s: string) => (
                              <label key={s} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer text-sm">
                                <Checkbox checked={selectedSubjects.includes(s)} onCheckedChange={() => toggleSubject(s)} />
                                {s}
                              </label>
                            ))
                          )}
                        </PopoverContent>
                      </Popover>
                      {selectedSubjects.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {selectedSubjects.map(s => (
                            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                        </div>
                      )}
                    </Field>

                    {chapterSuggestions.length > 0 && (
                      <Field label="Chapters" hint="Optional — leave empty to pull from all chapters.">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-10 justify-between font-normal">
                              {selectedChapters.length > 0
                                ? `${selectedChapters.length} selected`
                                : 'Select chapters…'}
                              <ChevronsUpDown className="h-4 w-4 ml-2 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-2 max-h-60 overflow-y-auto" align="start">
                            {chapterSuggestions.filter((c: string) => c?.trim()).map((c: string) => (
                              <label key={c} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer text-sm">
                                <Checkbox checked={selectedChapters.includes(c)} onCheckedChange={() => toggleChapter(c)} />
                                {c}
                              </label>
                            ))}
                          </PopoverContent>
                        </Popover>
                        {selectedChapters.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {selectedChapters.map(c => (
                              <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                            ))}
                          </div>
                        )}
                      </Field>
                    )}

                    <Field
                      label={`Questions in this assessment — ${effectiveCount}`}
                      hint={availableCount > 0 ? `${availableCount} question${availableCount === 1 ? '' : 's'} available in the bank with this combination` : 'No matching questions yet — pick subjects first'}
                    >
                      <Slider
                        value={[questionCount]}
                        onValueChange={([v]) => setQuestionCount(v)}
                        min={1}
                        max={Math.max(availableCount, 1)}
                        step={1}
                        className="mt-2"
                      />
                    </Field>

                    {selectedSubjects.length >= 2 && (
                      <Field label="Subject Weightage" hint="How questions are distributed across the chosen subjects. Must total 100%.">
                        <WeightageEditor
                          items={selectedSubjects.map(s => ({ key: s, label: s }))}
                          weights={subjectWeights}
                          onChange={setSubjectWeights}
                        />
                      </Field>
                    )}
                  </>
                )}
              </>
            )}
          </StepShell>
        )}

        {step === 'rules' && (
          <StepShell number={3} title="Rules & scoring" description="Control how the test is taken — order, time, attempts, and penalty for wrong answers.">
            <Field label="Question Order">
              <div className="grid grid-cols-2 gap-3">
                <ModeCard
                  active={shuffleQuestions}
                  onClick={() => setShuffleQuestions(true)}
                  icon={<Shuffle className="h-4 w-4" />}
                  title="Shuffle"
                  description="Each student will get a different set of questions."
                />
                <ModeCard
                  active={!shuffleQuestions}
                  onClick={() => setShuffleQuestions(false)}
                  icon={<ArrowDownUp className="h-4 w-4" />}
                  title="Constant"
                  description="The predefined questions will get shuffled in order."
                />
              </div>
            </Field>

            {mode === 'exam' && (
              <Field label="Time Limit" hint="Leave empty for no time limit.">
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={300}
                    placeholder="0"
                    value={timeLimitMinutes ?? ''}
                    onChange={e => setTimeLimitMinutes(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="h-10 pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">minutes</span>
                </div>
              </Field>
            )}

            <Field label="Pricing">
              <div className="grid grid-cols-2 gap-3">
                <ModeCard
                  active={pricingType === 'free'}
                  onClick={() => setPricingType('free')}
                  icon={<Sparkles className="h-4 w-4" />}
                  title="Free"
                  description="Students can take the test at no cost."
                />
                <ModeCard
                  active={pricingType === 'paid'}
                  onClick={() => setPricingType('paid')}
                  icon={<IndianRupee className="h-4 w-4" />}
                  title="Paid"
                  description="Students pay a fee to attempt the test."
                />
              </div>

              {pricingType === 'paid' && (
                <div className="mt-3 space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Price</p>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none">₹</span>
                      <Input
                        type="number"
                        min={1}
                        max={100000}
                        step={1}
                        placeholder="499"
                        value={price ?? ''}
                        onChange={e => setPrice(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                        className="h-9 pl-7"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Promo code (optional)</p>
                    <div className="grid grid-cols-[1fr_120px] gap-2">
                      <Input
                        placeholder="e.g. WELCOME26"
                        value={promoCode}
                        onChange={e => setPromoCode(e.target.value.toUpperCase())}
                        className="h-9 uppercase"
                        maxLength={20}
                      />
                      <div className="relative">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          step={1}
                          placeholder="10"
                          value={promoDiscountPct ?? ''}
                          onChange={e => setPromoDiscountPct(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                          disabled={!promoCode.trim()}
                          className="h-9 pr-8"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">%</span>
                      </div>
                    </div>
                    {promoCode.trim() && price && promoDiscountPct && (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Code <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">{promoCode.trim()}</span> gives {promoDiscountPct}% off — students pay
                        {' '}<span className="font-semibold text-emerald-700 dark:text-emerald-400">₹{Math.max(0, Math.round(price * (1 - promoDiscountPct / 100)))}</span>{' '}
                        instead of ₹{price}.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Field>

            <Field
              label="Max Attempts per Student"
              hint={maxAttempts ? `Students can attempt this test up to ${maxAttempts} time${maxAttempts === 1 ? '' : 's'}.` : 'Students can retake this test as many times as they want.'}
            >
              <div className="flex items-center gap-2 flex-wrap">
                {[1, 3, 5].map(n => (
                  <Button
                    key={n}
                    type="button"
                    variant={maxAttempts === n ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 min-w-[48px] h-9"
                    onClick={() => setMaxAttempts(n)}
                  >
                    {n}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={maxAttempts === undefined ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 min-w-[80px] h-9"
                  onClick={() => setMaxAttempts(undefined)}
                >
                  Unlimited
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  placeholder="Custom"
                  value={maxAttempts !== undefined && ![1, 3, 5].includes(maxAttempts) ? maxAttempts : ''}
                  onChange={e => setMaxAttempts(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="flex-1 min-w-[100px] h-9"
                />
              </div>
            </Field>

            <Field label="Negative Marking">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5">
                <p className="text-sm text-slate-700 dark:text-slate-300">Penalise wrong answers</p>
                <Switch checked={negativeMarking} onCheckedChange={setNegativeMarking} />
              </div>

              {negativeMarking && perSectionAvailable && (
                <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3">
                  <div className="flex gap-2">
                    {(['paper', 'section'] as const).map(scope => (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => setNegativeScope(scope)}
                        className={
                          'flex-1 rounded-lg border px-3 py-2 text-left transition-colors ' +
                          (negativeScope === scope
                            ? 'border-orange-400 bg-orange-50 dark:bg-orange-950/30'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300')
                        }
                      >
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {scope === 'paper' ? 'One value' : 'Per section'}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {scope === 'paper'
                            ? 'Same deduction everywhere.'
                            : `${patternSections.length} sections, marked separately.`}
                        </p>
                      </button>
                    ))}
                  </div>

                  {usingPerSection && (
                    <div className="space-y-2">
                      {patternSections.map(sec => (
                        <div
                          key={sec.name}
                          className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                              {sec.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {sec.attempt && sec.attempt !== sec.questions
                                ? `any ${sec.attempt} of ${sec.questions}`
                                : `${sec.questions} questions`}
                              {sec.marks_per_question ? ` · ${sec.marks_per_question} mark${sec.marks_per_question === 1 ? '' : 's'} each` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[11px] text-slate-500">deduct</span>
                            <Select
                              value={String(sectionNegatives[sec.name] ?? 0.25)}
                              onValueChange={v =>
                                setSectionNegatives(prev => ({ ...prev, [sec.name]: parseFloat(v) }))
                              }
                            >
                              <SelectTrigger className="h-8 w-[92px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[0.25, 0.33, 0.5, 0.75, 1, 1.5, 2].map(d => (
                                  <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-2.5 py-2">
                        Per-section deductions are saved with the paper, but scoring applies
                        them only once the backend supports it (GAT_B_BACKEND_CHANGES.md §6).
                        Until then this paper is scored at −{leastNegative({ ...examPattern!, sections: patternSections.map(sec => ({ ...sec, negative_mark_value: sectionNegatives[sec.name] })) })} for every wrong answer.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {negativeMarking && !usingPerSection && (
                <div className="mt-3 space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">For every</p>
                      <Select
                        value={String(negativeMarkWrongs)}
                        onValueChange={v => setNegativeMarkWrongs(parseInt(v, 10))}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 10].map(n => (
                            <SelectItem key={n} value={String(n)}>
                              {n} wrong answer{n === 1 ? '' : 's'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Deduct</p>
                      <Select
                        value={String(negativeMarkDeduction)}
                        onValueChange={v => setNegativeMarkDeduction(parseFloat(v))}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[0.25, 0.5, 0.75, 1, 1.5, 2].map(d => (
                            <SelectItem key={d} value={String(d)}>
                              {d} mark{d === 1 ? '' : 's'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    For every <span className="font-semibold text-slate-700 dark:text-slate-300">{negativeMarkWrongs}</span> wrong answer{negativeMarkWrongs === 1 ? '' : 's'},
                    {' '}<span className="font-semibold text-slate-700 dark:text-slate-300">{negativeMarkDeduction}</span> mark{negativeMarkDeduction === 1 ? '' : 's'} will be deducted.
                    {negativeMarkWrongs > 1 && ' Partial groups don\'t count.'}
                  </p>
                </div>
              )}
            </Field>
          </StepShell>
        )}

        {step === 'schedule' && (
          <StepShell number={4} title="Schedule" description="Set an optional due date. Students won't be able to start the test after the deadline.">
            <Field label="Due Date" hint="Leave empty for no deadline.">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal h-10',
                      !dueDate && 'text-slate-400'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'EEEE, d MMMM yyyy') : 'No deadline'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    disabled={date => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {dueDate && (
                <button
                  onClick={() => setDueDate(undefined)}
                  className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 mt-2"
                >
                  Clear date
                </button>
              )}
            </Field>
          </StepShell>
        )}

        {step === 'review' && (
          <StepShell number={5} title="Review" description="Confirm the configuration. You can go back and edit any step before creating the assessment.">
            <ReviewSummary
              title={title}
              mode={mode}
              testType={testType}
              difficulty={difficulty}
              source={source}
              sourceType={sourceType}
              papers={paperIds.map(id => {
                const p = (papers as any[]).find((x: any) => x.id === id);
                return { id, title: p?.title || id };
              })}
              paperWeights={paperWeights}
              subjects={selectedSubjects}
              subjectWeights={subjectWeights}
              chapters={selectedChapters}
              questionCount={effectiveCount}
              shuffleQuestions={shuffleQuestions}
              timeLimitMinutes={timeLimitMinutes}
              maxAttempts={maxAttempts}
              negativeMarking={negativeMarking}
              negativeMarkValue={negativeMarkDeduction}
              negativeMarkMode={negativeMarkMode}
              negativeMarkGroupSize={negativeMarkWrongs}
              dueDate={dueDate}
              pricingType={pricingType}
              price={price}
              promoCode={promoCode.trim()}
              promoDiscountPct={promoDiscountPct}
            />
            {!canSubmit && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-3 text-xs text-amber-800 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  Some required fields are missing. Go back and complete the highlighted steps before creating the assessment.
                </p>
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
            <Button size="sm" onClick={handleCreate} disabled={!canSubmit || createAssessment.isPending} className="gap-1.5">
              {createAssessment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Create Assessment
            </Button>
          )}
        </div>
      </div>

      {/* Live summary sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 mb-3">
            Assessment Summary
          </p>
          <LiveSummary
            title={title}
            mode={mode}
            testType={testType}
            difficulty={difficulty}
            source={source}
            sourceType={sourceType}
            papers={paperIds.map(id => {
              const p = (papers as any[]).find((x: any) => x.id === id);
              return { id, title: p?.title || id };
            })}
            paperWeights={paperWeights}
            subjects={selectedSubjects}
            subjectWeights={subjectWeights}
            chapters={selectedChapters}
            questionCount={effectiveCount}
            shuffleQuestions={shuffleQuestions}
            timeLimitMinutes={timeLimitMinutes}
            maxAttempts={maxAttempts}
            negativeMarking={negativeMarking}
            negativeMarkValue={negativeMarkDeduction}
            negativeMarkMode={negativeMarkMode}
            negativeMarkGroupSize={negativeMarkWrongs}
            dueDate={dueDate}
            pricingType={pricingType}
            price={price}
            promoCode={promoCode.trim()}
            promoDiscountPct={promoDiscountPct}
          />
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
                isReachable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
              )}
            >
              <span
                className={cn(
                  'flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all',
                  isCurrent && 'border-indigo-600 bg-indigo-600 text-white ring-4 ring-indigo-100 dark:ring-indigo-950/60',
                  isPast && 'border-indigo-600 bg-indigo-600 text-white',
                  !isCurrent && !isPast && 'border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                )}
              >
                {isPast ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span
                className={cn(
                  'text-[11px] font-medium uppercase tracking-wider',
                  isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
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
                    i < currentIndex ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
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

// ─── Step shell ─────────────────────────────────────────────────────────────

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

// ─── Field ──────────────────────────────────────────────────────────────────

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

// ─── Mode / pool cards ─────────────────────────────────────────────────────

function ModeCard({
  active,
  onClick,
  icon,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  /** Optional — the Mock test / Practice pair is self-explanatory and shows none. */
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-left rounded-lg border p-3 transition-all',
        active
          ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 ring-1 ring-indigo-500/30'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
      )}
    >
      <div className={cn('flex items-center gap-2', description && 'mb-1')}>
        <span className={cn('flex items-center justify-center w-6 h-6 rounded-md', active ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500')}>
          {icon}
        </span>
        <p className={cn('text-sm font-semibold', active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200')}>
          {title}
        </p>
      </div>
      {description && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
      )}
    </button>
  );
}

function PoolButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-2 text-sm font-medium transition-all',
        active
          ? 'border-indigo-500 bg-indigo-50/60 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300 ring-1 ring-indigo-500/30'
          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
      )}
    >
      {children}
    </button>
  );
}

// ─── Review summary ─────────────────────────────────────────────────────────

function ReviewSummary(props: {
  title: string;
  mode: string;
  testType?: string;
  difficulty: string;
  source: 'bank' | 'paper';
  sourceType: string;
  papers: { id: string; title: string }[];
  paperWeights: Record<string, number>;
  subjects: string[];
  subjectWeights: Record<string, number>;
  chapters: string[];
  questionCount: number;
  shuffleQuestions: boolean;
  timeLimitMinutes?: number;
  maxAttempts?: number;
  negativeMarking: boolean;
  negativeMarkValue: number;
  negativeMarkMode: 'per_question' | 'per_group';
  negativeMarkGroupSize: number;
  dueDate?: Date;
  pricingType?: 'free' | 'paid';
  price?: number;
  promoCode?: string;
  promoDiscountPct?: number;
}) {
  const sourceLabel =
    props.source === 'paper'
      ? `From ${props.papers.length === 1 ? 'paper' : `${props.papers.length} papers`}`
      : `From question bank · ${props.sourceType === 'all' ? 'any source' : props.sourceType || '—'}`;
  const modeLabel = props.mode === 'exam' ? 'Mock test' : 'Practice';

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
      <SummaryRow label="Title" value={props.title || <em className="text-slate-400">Untitled</em>} />
      <SummaryRow label="Mode" value={modeLabel} />
      <SummaryRow label="Test Type" value={props.testType || <em className="text-slate-400">Not set</em>} />
      <SummaryRow label="Difficulty" value={<span className="capitalize">{props.difficulty}</span>} />
      <SummaryRow label="Question Order" value={props.shuffleQuestions ? 'Shuffled per student' : 'Same fixed order'} />
      <SummaryRow label="Source" value={sourceLabel} />
      {props.source === 'paper' && props.papers.length > 0 && (
        <SummaryRow
          label="Papers"
          value={
            <div className="flex flex-wrap gap-1">
              {props.papers.map(p => (
                <Badge key={p.id} variant="secondary" className="text-xs">
                  {p.title}
                  {props.papers.length > 1 && props.paperWeights[p.id] != null && (
                    <span className="text-slate-400 ml-1">· {props.paperWeights[p.id]}%</span>
                  )}
                </Badge>
              ))}
            </div>
          }
        />
      )}
      {props.source !== 'paper' && props.subjects.length > 0 && (
        <SummaryRow
          label="Subjects"
          value={
            <div className="flex flex-wrap gap-1">
              {props.subjects.map(s => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {s}
                  {props.subjects.length > 1 && props.subjectWeights[s] != null && (
                    <span className="text-slate-400 ml-1">· {props.subjectWeights[s]}%</span>
                  )}
                </Badge>
              ))}
            </div>
          }
        />
      )}
      {props.chapters.length > 0 && (
        <SummaryRow
          label="Chapters"
          value={
            <div className="flex flex-wrap gap-1">
              {props.chapters.map(c => (
                <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
              ))}
            </div>
          }
        />
      )}
      <SummaryRow label="Questions" value={`${props.questionCount} ${props.questionCount === 1 ? 'question' : 'questions'}`} />
      {props.mode === 'exam' && (
        <SummaryRow label="Time Limit" value={props.timeLimitMinutes ? `${props.timeLimitMinutes} minutes` : 'No limit'} />
      )}
      <SummaryRow
        label="Pricing"
        value={
          props.pricingType === 'paid'
            ? (
              <div>
                <p>₹{props.price ?? '—'}</p>
                {props.promoCode && props.promoDiscountPct ? (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Promo <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{props.promoCode}</span> · {props.promoDiscountPct}% off →{' '}
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                      ₹{props.price ? Math.max(0, Math.round(props.price * (1 - props.promoDiscountPct / 100))) : '—'}
                    </span>
                  </p>
                ) : null}
              </div>
            )
            : 'Free'
        }
      />
      <SummaryRow label="Attempts" value={props.maxAttempts ? `Up to ${props.maxAttempts}` : 'Unlimited'} />
      <SummaryRow
        label="Negative Marking"
        value={
          props.negativeMarking
            ? props.negativeMarkGroupSize > 1
              ? `−${props.negativeMarkValue} per ${props.negativeMarkGroupSize} wrong`
              : `−${props.negativeMarkValue} per wrong`
            : 'Off'
        }
      />
      <SummaryRow label="Due Date" value={props.dueDate ? format(props.dueDate, 'EEEE, d MMMM yyyy') : 'No deadline'} />
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

type LiveSummaryProps = React.ComponentProps<typeof ReviewSummary>;

function LiveSummary(props: LiveSummaryProps) {
  const rows: { label: string; value: React.ReactNode; placeholder?: string }[] = [
    { label: 'Title', value: props.title || null, placeholder: 'Untitled' },
    { label: 'Mode', value: props.mode ? (props.mode === 'exam' ? 'Mock test' : 'Practice') : null },
    { label: 'Test Type', value: props.testType || null, placeholder: 'Not set' },
    { label: 'Difficulty', value: props.difficulty ? <span className="capitalize">{props.difficulty}</span> : null },
    {
      label: 'Source',
      value: props.source === 'paper'
        ? props.papers.length > 0
          ? `${props.papers.length} paper${props.papers.length === 1 ? '' : 's'}`
          : null
        : props.sourceType
          ? `${props.sourceType === 'all' ? 'Any' : props.sourceType.charAt(0).toUpperCase() + props.sourceType.slice(1)}${props.subjects.length > 0 ? ' · ' + props.subjects.length + ' subj' : ''}`
          : null,
      placeholder: 'Not selected',
    },
    {
      label: 'Questions',
      value: props.questionCount > 0 ? `${props.questionCount}` : null,
      placeholder: '—',
    },
    {
      label: 'Order',
      value: props.shuffleQuestions ? 'Shuffled' : 'Constant',
    },
    ...(props.mode === 'exam'
      ? [{
        label: 'Time Limit',
        value: props.timeLimitMinutes ? `${props.timeLimitMinutes} min` : 'No limit',
      }]
      : []),
    {
      label: 'Attempts',
      value: props.maxAttempts ? `Up to ${props.maxAttempts}` : 'Unlimited',
    },
    {
      label: 'Pricing',
      value: props.pricingType === 'paid'
        ? (props.promoCode && props.promoDiscountPct && props.price
          ? `₹${Math.max(0, Math.round(props.price * (1 - props.promoDiscountPct / 100)))} (${props.promoDiscountPct}% off ₹${props.price})`
          : props.price ? `₹${props.price}` : 'Paid · ₹—')
        : 'Free',
    },
    {
      label: 'Negative',
      value: props.negativeMarking
        ? (props.negativeMarkGroupSize > 1
          ? `−${props.negativeMarkValue} / ${props.negativeMarkGroupSize} wrong`
          : `−${props.negativeMarkValue} / wrong`)
        : 'Off',
    },
    {
      label: 'Due',
      value: props.dueDate ? format(props.dueDate, 'd MMM yyyy') : 'No deadline',
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
