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
  AlertTriangle,
  IndianRupee,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEvalSubjectSuggestions, useEvalPapers, useEvalQuestions } from '@/hooks/use-evaluation';
import { describePool } from '@/lib/assessment-pool';
import { useCreateEvalAssessment, type EvalAssessmentConfig } from '@/hooks/use-eval-assessments';
import { WeightageEditor } from '@/components/personal-assessments/WeightageEditor';
import { distributeEvenly, distributeQuestions, validateWeightage } from '@/lib/distribution-utils';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { toast } from 'sonner';
import { FULL_PAPER_BLEND, blendTargets, describeBlend, explainBlendShortfall, pickByBlend } from '@/lib/difficulty-blend';
import { composeByGroups, planGroups } from '@/lib/compose-pool';
import {
  difficultySpread,
  inSelectedSubjects,
  matchesDifficulty,
  poolDifficulty,
  sameSubject,
} from '@/lib/question-pool';
import type { QuestionDifficulty } from '@/lib/eval-difficulty';
import { difficultyLabel, toStored } from '@/lib/eval-difficulty';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { TnpscTagFields } from '@/components/evaluation/TnpscTagFields';
import { UnitPoolDiagnosis, UnitPoolPicker } from '@/components/evaluation/UnitPoolPicker';
import { UnitMappingDialog } from '@/components/evaluation/UnitMappingDialog';
import { EMPTY_TAG, describeTag, describeTagError, examTypeLabel, suggestAssessmentTitle, tagAssessmentKeepingTopic, topicIdForUnit, validateTnpscTag, type TnpscTagValue } from '@/lib/tnpscAdminApi';
import {
  hasPerSectionNegative,
  leastNegative,
  stageForExamType,
  stageUnits,
  unitDisplayName,
  unitTopics,
  findUnit,
  type TnpscPatternSection,
  type TnpscSyllabusUnit,
} from '@/config/tnpsc';
import { findStage } from '@/config/tnpsc';
import {
  inSelectedUnits,
  questionInUnit,
  subjectWeightsFromUnits,
  unitBankCounts,
  unitIdsOf,
  unitSubjectIds,
  unitWeightsFromSyllabus,
} from '@/lib/unit-pool';
import { getSyllabusChapters, getSyllabusSubjects } from '@/data/examSyllabus';
import { bankCategoryCounts } from '@/lib/key-topics';

interface Props {
  onCreated: (assessmentId: string) => void;
  onBack?: () => void;
  /**
   * A placement to start on — from New beside a spot in the Assessments tree (Mock, Key Topics or Practice, then
   * subject and unit). The form opens already placed there.
   */
  initialTag?: Partial<TnpscTagValue>;
}

const STEPS = [
  { key: 'basics', label: 'Basics', icon: BookOpen },
  { key: 'content', label: 'Content', icon: Layers },
  { key: 'rules', label: 'Rules', icon: Target },
  { key: 'schedule', label: 'Schedule', icon: CalendarDays },
  { key: 'review', label: 'Review', icon: Check },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

/**
 * Why a pool is empty, when the subject itself is not.
 *
 * "0 questions" reads as "the bank has none", which sent an admin hunting for
 * questions they could see in the Question Bank. When the subject has questions
 * and the *difficulty* is what emptied the pool, say so, show what is there, and
 * offer the way past it.
 */
function PoolExplainer({
  pool,
  wanted,
  onUseAny,
  noun = 'subject',
  onShowMapping,
}: {
  pool: Array<{ difficulty?: string | null }>;
  wanted: QuestionDifficulty;
  onUseAny: () => void;
  /** Where the unit picker is in use: shows which collection each question came from. */
  onShowMapping?: () => void;
  /** What the pool is drawn from — "unit" where the paper picks units, so it does not say "subject". */
  noun?: string;
}) {
  const spread = difficultySpread(pool);
  const parts = (['easy', 'medium', 'hard'] as QuestionDifficulty[])
    .filter(d => spread[d] > 0)
    .map(d => `${spread[d]} ${difficultyLabel(d)}`);
  if (spread.untagged > 0) parts.push(`${spread.untagged} ungraded`);

  return (
    <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/30">
      <p className="font-semibold text-amber-900 dark:text-amber-200">
        0 {difficultyLabel(wanted)} questions — but this {noun} has {pool.length}.
      </p>
      <p className="mt-1 leading-relaxed text-amber-800/90 dark:text-amber-300/90">
        In the bank: {parts.join(' · ')}. The paper is set to {difficultyLabel(wanted)}, so only
        those are drawn. Grade them in the Question Bank, or use every difficulty here.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onUseAny}>
          Use all {pool.length} questions
        </Button>
        {onShowMapping && (
          <button
            type="button"
            onClick={onShowMapping}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Expected more? See where each collection’s questions went →
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The difficulty an assessment actually has, read off the questions going into it.
 *
 * The picker beside it is a *default*: it seeds generation and filters the bank,
 * and it keeps its value whatever you then select. So a collection of 100 hard
 * questions was being saved as "medium" — the default nobody had touched — and the
 * paper then misreported itself everywhere downstream: the portal's difficulty
 * chips, the report's difficulty analysis, and the study plan's weighting all read
 * this field rather than the questions.
 *
 * Unanimous questions decide it. A genuine mix is recorded as such rather than
 * flattened to one of its parts. Questions that declare nothing leave the default
 * standing, which is the one case where the picker is the best answer available.
 */
function difficultyOf(questions: Array<{ difficulty?: string | null }>, fallback: string): string {
  const seen = new Set(
    questions.map(q => (q?.difficulty ?? '').trim().toLowerCase()).filter(Boolean),
  );
  if (seen.size === 0) return fallback;
  if (seen.size === 1) return [...seen][0];
  return 'mixed';
}

export function EvalAssessmentConfigPanel({ onCreated, onBack, initialTag }: Props) {
  const { profileContext } = useWorkspaceContext();
  const createAssessment = useCreateEvalAssessment();

  // ── Form state ──
  const [title, setTitle] = useState('');
  /** Set once the admin edits the title, after which it is never overwritten. */
  const [titleEdited, setTitleEdited] = useState(false);
  // TNPSC placement — decides where this paper appears in the aspirant portal.
  // `track` is driven by the assessment mode below, so it is not editable here.
  const [tnpscTag, setTnpscTag] = useState<TnpscTagValue>({ ...EMPTY_TAG, track: 'mock', ...initialTag });
  const [sourceType, setSourceType] = useState<'online' | 'text' | 'file' | 'all' | ''>('');
  const [source, setSource] = useState<'bank' | 'paper'>('bank');
  const [paperIds, setPaperIds] = useState<string[]>([]);
  const [paperWeights, setPaperWeights] = useState<Record<string, number>>({});
  const [difficulty, setDifficulty] = useState('medium');
  // Test type is no longer picked by hand — it follows the TNPSC placement below
  // (e.g. "TNPSC Group 1 Prelims"), which keeps it aligned with the syllabus keys
  // used by the question generator.
  /** Subjects ticked by hand. Where the stage has published units, they come from `selectedUnitIds` instead. */
  const [pickedSubjects, setPickedSubjects] = useState<string[]>([]);
  /** Published syllabus units chosen as the pool — the way a Group 4 paper is actually specified. */
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  /** The per-collection view of where the bank's questions landed. */
  const [mappingOpen, setMappingOpen] = useState(false);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(20);
  const [selectedTypes] = useState<string[]>(['mcq']);
  const [dueDate, setDueDate] = useState<Date | undefined>();
  // The mode follows the track: a practice placement starts the form as a practice assessment.
  const [mode, setMode] = useState(initialTag?.track === 'practice' ? 'practice' : 'exam');
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

  // ── The pool, by published syllabus unit ──
  //
  // Group 4 is specified in units ("15 from Unit IV, 20 from Unit V"), not in the
  // catalog's subjects — and General Tamil's seven units are one subject, so a
  // subject picker cannot say which of them a paper draws on. Where the placed stage
  // publishes units, the picker offers those, and the subjects the rest of the
  // panel works in are *derived* from them.
  const stageUnitList = useMemo(() => stageUnits(tnpscStage), [tnpscStage]);
  const unitMode = source === 'bank' && stageUnitList.length > 0;
  const selectedUnits = useMemo(
    () => (unitMode ? stageUnitList.filter(x => selectedUnitIds.includes(x.unit.id)).map(x => x.unit) : []),
    [unitMode, stageUnitList, selectedUnitIds],
  );
  const selectedSubjects = useMemo(() => {
    if (!unitMode) return pickedSubjects;
    const names: string[] = [];
    for (const u of selectedUnits) {
      for (const id of unitSubjectIds(tnpscStage, u)) {
        const name = tnpscStage?.subjects.find(s => s.id === id)?.name;
        if (name && !names.includes(name)) names.push(name);
      }
    }
    return names;
  }, [unitMode, pickedSubjects, selectedUnits, tnpscStage]);

  /** What a paper is split across — units where there are units, subjects otherwise. */
  const groups = useMemo(
    () =>
      unitMode
        ? selectedUnits.map(u => ({
            key: u.id,
            label: `${u.label ? `${u.label}. ` : ''}${unitDisplayName(tnpscStage, u)}`,
            cluster: stageUnitList.find(x => x.unit.id === u.id)?.sectionName,
            test: (q: any) => questionInUnit(tnpscStage, q, u),
          }))
        : selectedSubjects.map(name => ({
            key: name,
            label: name,
            cluster: undefined as string | undefined,
            test: (q: any) => sameSubject(tnpscStage, q?.subject, name),
          })),
    [unitMode, selectedUnits, selectedSubjects, tnpscStage, stageUnitList],
  );

  const applyUnits = (ids: string[]) => {
    setSelectedUnitIds(ids);
    // Weights follow the published split by default — Units IV and V open at 15 : 20.
    setSubjectWeights(unitWeightsFromSyllabus(stageUnitList.filter(x => ids.includes(x.unit.id)).map(x => x.unit)));
    setSelectedChapters([]);
  };
  const toggleUnit = (id: string) =>
    applyUnits(selectedUnitIds.includes(id) ? selectedUnitIds.filter(x => x !== id) : [...selectedUnitIds, id]);

  // Units the new stage does not publish are dropped, as off-exam subjects are.
  useEffect(() => {
    const valid = new Set(stageUnitList.map(x => x.unit.id));
    setSelectedUnitIds(prev => {
      const kept = prev.filter(id => valid.has(id));
      return kept.length === prev.length ? prev : kept;
    });
  }, [stageUnitList]);

  // A practice paper's placement already names what it covers: a unit paper draws
  // that unit, a section paper draws the section's units. Follow it, so the pool and
  // where the paper appears in the portal cannot quietly disagree. The admin can still
  // change the selection afterwards.
  useEffect(() => {
    if (!unitMode || tnpscTag.track !== 'practice') return;
    const ids =
      (tnpscTag.scope === 'unit' || tnpscTag.scope === 'topic') && tnpscTag.unit_id
        ? [tnpscTag.unit_id]
        : tnpscTag.scope === 'section' && tnpscTag.section_name
          ? stageUnitList.filter(x => x.sectionName === tnpscTag.section_name).map(x => x.unit.id)
          : null;
    if (ids && ids.length > 0) applyUnits(ids);
    // Keyed on the placement, so the admin's own edits are not overwritten on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitMode, tnpscTag.track, tnpscTag.scope, tnpscTag.unit_id, tnpscTag.section_name, stageUnitList]);

  const applyTnpscPattern = () => {
    const p = tnpscStage?.pattern;
    if (!p) return;
    setQuestionCount(p.total_questions);
    setTimeLimitMinutes(p.duration_minutes);
    setNegativeMarking(p.negative_marking);
    toast.success(`Applied ${tnpscStage!.short_name} pattern — ${p.total_questions} questions, ${p.duration_minutes} min.`);
  };

  /** Off by default: the picker shows the selected exam's subjects only. */
  const [showAllSubjects, setShowAllSubjects] = useState(false);

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

  /**
   * Chapters for the chosen subject, from the exam's syllabus where it has them.
   *
   * Same reason as the subjects: the syllabus knows the chapters before the bank
   * holds a question from any of them. Falls back to whatever the bank has seen
   * for an exam the syllabus does not cover.
   */

  /**
   * Only the source is filtered server-side.
   *
   * Subject and difficulty used to be sent as query parameters, and both were
   * exact matches against the wrong thing: the picker offers the syllabus's
   * "Geography of India" while the bank holds whatever the import tagged
   * ("Geography"), and the Default Difficulty picker — meant as a fallback — was
   * quietly a filter. Either one returned an empty pool with no explanation. The
   * bank is fetched once and narrowed here, where the match can be made on what
   * the subject *is* (see `question-pool.ts`). It is the same unfiltered request
   * the Question Bank page makes, so the two share a cache.
   */
  const bankFilters = useMemo(() => ({
    source: effectiveSourceFilter,
  }), [effectiveSourceFilter]);
  const {
    data: rawBankQuestions = [],
    isLoading: bankLoading,
    isError: bankError,
    error: bankErr,
    refetch: refetchBank,
  } = useEvalQuestions(source === 'bank' && sourceType ? bankFilters : undefined);

  /**
   * Each bank question with the name of the collection it came from.
   *
   * A question lists only its `paper_id`. The collection's name is where an author said
   * which unit a sheet was for, and unit placement falls back on it (`collection-unit.ts`)
   * when a question's own tags do not say.
   */
  const bankQuestions = useMemo(() => {
    const titleById = new Map<string, string>((papers as any[]).map(p => [p.id, p.title]));
    return (rawBankQuestions as any[]).map(q => {
      const title = q?.paper_id ? titleById.get(q.paper_id) : undefined;
      return title ? { ...q, paper_title: title } : q;
    });
  }, [rawBankQuestions, papers]);

  /** What the bank can supply to each unit, shown beside the unit's published count. */
  const unitCounts = useMemo(
    () => (unitMode ? unitBankCounts(tnpscStage, bankQuestions as any[]) : null),
    [unitMode, tnpscStage, bankQuestions],
  );

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

  /**
   * The subjects of the selected exam, and only those.
   *
   * Sourced from the exam's own syllabus (`EXAM_SYLLABUS`, keyed "TNPSC Group 1" /
   * "TNPSC Group 4" / "GAT-B") rather than from the question bank. The bank holds
   * every subject the organisation has ever ingested, so a Group 4 paper was being
   * offered "English Language" and "Numerical Ability" — IBPS sections that stage
   * does not examine. The syllabus is also the right source when the bank is still
   * empty for an exam: the admin can pick General Science before a single General
   * Science question exists.
   *
   * Subjects already chosen are kept, so switching the source filter cannot
   * silently drop a selection.
   */
  const examSubjects = useMemo(() => getSyllabusSubjects(testType), [testType]);

  const examSubjectOptions = useMemo(() => {
    if (examSubjects.length === 0 || showAllSubjects) return subjectOptions;
    const seen = new Map<string, string>();
    [...examSubjects, ...selectedSubjects].forEach(name => {
      const label = (name ?? '').trim();
      if (label && !seen.has(label.toLowerCase())) seen.set(label.toLowerCase(), label);
    });
    return Array.from(seen.values());
  }, [examSubjects, subjectOptions, selectedSubjects, showAllSubjects]);

  /** How many bank subjects this exam does not examine — counted, not listed. */
  const offExamCount = useMemo(() => {
    if (examSubjects.length === 0) return 0;
    const inExam = new Set(examSubjects.map(x => x.toLowerCase()));
    return subjectOptions.filter(x => !inExam.has(x.toLowerCase())).length;
  }, [examSubjects, subjectOptions]);

  /**
   * Changing the exam drops subjects the new one does not examine.
   *
   * Keeping them would quietly generate a Group 4 paper out of Reasoning Ability
   * questions, which is the mix this picker exists to prevent.
   */
  useEffect(() => {
    if (examSubjects.length === 0) return;
    const inExam = new Set(examSubjects.map(x => x.toLowerCase()));
    setPickedSubjects(prev => {
      const kept = prev.filter(x => inExam.has(x.toLowerCase()));
      return kept.length === prev.length ? prev : kept;
    });
    // Only when the exam changes — not on every edit elsewhere on the step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testType]);

  /**
   * Every bank question in the chosen subjects, at any difficulty.
   *
   * Kept apart from `matchingQuestions` so that when the difficulty empties the
   * pool the screen can say *what is there instead* — "0 Complex, but 58 Medium"
   * — rather than a bare zero that reads as "no such questions exist".
   */
  const subjectPool = useMemo(() => {
    if (source === 'paper') return [] as any[];
    if (unitMode) return (bankQuestions as any[]).filter((q: any) => inSelectedUnits(tnpscStage, q, selectedUnits));
    return (bankQuestions as any[]).filter((q: any) =>
      inSelectedSubjects(tnpscStage, q?.subject, selectedSubjects),
    );
  }, [bankQuestions, selectedSubjects, selectedUnits, unitMode, tnpscStage, source]);

  /** The placed unit's categories, as the bank tags its questions, with counts — the key-topic choices. */
  const placedUnit = findUnit(tnpscStage, tnpscTag.unit_id);
  const categoryOptions = useMemo(
    () =>
      tnpscTag.scope === 'topic' && placedUnit
        ? bankCategoryCounts(tnpscStage, placedUnit, bankQuestions as any[])
        : null,
    [tnpscTag.scope, placedUnit, tnpscStage, bankQuestions],
  );

  /**
   * Chapters to choose from: what the bank holds, then what the syllabus expects.
   *
   * Both lists matter and they are not the same thing. The bank's chapters are
   * the only ones that can actually select a question — a chapter with nothing
   * behind it yields an empty paper. The syllabus's are what *should* exist, so
   * they are still offered, marked, and listed second.
   *
   * Preferring the syllabus outright (as this did) hid the real names entirely:
   * General Tamil's questions are tagged with whatever their import used, so the
   * only selectable chapters were invisible and every pick returned nothing.
   */
  const chapterSuggestions = useMemo(() => {
    // Read off the questions that actually matched the subject, rather than asked
    // of `/evaluation/chapters` by exact name — which returned nothing for
    // "Geography of India" while the bank held the chapters under "Geography".
    const inBank = Array.from(
      new Set(subjectPool.map((q: any) => (q?.chapter ?? '').trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
    const seen = new Set(inBank.map(c => c.trim().toLowerCase()));
    const expectedNames = unitMode
      ? selectedUnits.flatMap(u => unitTopics(tnpscStage, u).map(t => t.name))
      : getSyllabusChapters(testType, activeSubject);
    const expected = expectedNames.filter(
      c => c?.trim() && !seen.has(c.trim().toLowerCase()),
    );
    return [
      ...inBank.map(name => ({ name, inBank: true })),
      ...expected.map(name => ({ name, inBank: false })),
    ];
  }, [testType, activeSubject, subjectPool, unitMode, selectedUnits, tnpscStage]);

  const emptyChapterCount = chapterSuggestions.filter(c => !c.inBank).length;

  /**
   * The one difficulty the pool is held to, or null.
   *
   * Set by what the paper is — a unit pitched at Complex draws Complex — and not
   * by the Default Difficulty picker. `anyDifficulty` is the admin's way past it
   * when the bank has not been graded yet.
   */
  const [anyDifficulty, setAnyDifficulty] = useState(false);
  const wantedDifficulty = anyDifficulty ? null : poolDifficulty(tnpscTag, difficulty);
  useEffect(() => {
    setAnyDifficulty(false);
  }, [tnpscTag.level, tnpscTag.unit_id, tnpscTag.scope, tnpscTag.track, selectedSubjects.join('|')]);

  const matchingQuestions = useMemo(() => {
    if (source === 'paper') return [];
    let qs = subjectPool.filter((q: any) => matchesDifficulty(q, wantedDifficulty));
    // A key-topic paper is drawn from its category alone.
    if (tnpscTag.scope === 'topic' && tnpscTag.topic_id) {
      const wanted = tnpscTag.topic_id.trim();
      qs = qs.filter((q: any) => (q?.category ?? '').trim() === wanted);
    }
    if (selectedChapters.length > 0) {
      qs = qs.filter((q: any) => selectedChapters.includes(q.chapter));
    }
    if (selectedTypes.length > 0) {
      qs = qs.filter((q: any) => selectedTypes.includes(q.type));
    }
    return qs;
  }, [subjectPool, wantedDifficulty, selectedChapters, selectedTypes, source, tnpscTag.scope, tnpscTag.topic_id]);

  const toggleSubject = (s: string) => {
    setPickedSubjects(prev => {
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
    if (groups.length < 2) return true;
    return validateWeightage(subjectWeights).valid;
  }, [groups, subjectWeights]);

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

  /**
   * The title the placement implies — "TNPSC Group 4 — Indian Polity · Simple".
   *
   * The cascade already says what the paper is, so naming it by hand means
   * restating that choice, and two hundred hand-named papers do not sort or scan.
   * It fills in as the placement is answered and stops the moment it is typed in.
   */
  const suggestedTitle = useMemo(() => suggestAssessmentTitle(tnpscTag), [tnpscTag]);

  useEffect(() => {
    if (titleEdited || !suggestedTitle) return;
    setTitle(prev => (prev === suggestedTitle ? prev : suggestedTitle));
  }, [suggestedTitle, titleEdited]);

  /**
   * True when the placement says this paper stands for the whole of something.
   *
   * Mirrors the same rule in `TnpscTagFields`, which shows the admin the blend
   * before they create it — the panel's promise and this selection have to agree.
   */
  const wantsBlend =
    tnpscTag.track === 'mock' ||
    (tnpscTag.track === 'practice' && tnpscTag.scope === 'section') ||
    (tnpscTag.track === 'practice' && (tnpscTag.scope === 'unit' || tnpscTag.scope === 'topic') && !tnpscTag.level);

  // The fallback difficulty is no longer asked for, so it follows the placement: a unit
  // pitched at one level saves as that level. Whole papers take their difficulty from
  // the questions they are composed of (`difficultyOf`), so there is nothing to follow.
  useEffect(() => {
    if (tnpscTag.track === 'practice' && (tnpscTag.scope === 'unit' || tnpscTag.scope === 'topic') && tnpscTag.level) {
      setDifficulty(toStored(tnpscTag.level));
    }
  }, [tnpscTag.track, tnpscTag.scope, tnpscTag.level]);

  /**
   * Whether the bank can actually supply the blend, checked on the pool as it stands.
   *
   * The summary promised "Auto blend 20 / 30 / 50" whatever the bank held, so a Mixed
   * paper over a bank graded entirely Complex was created, labelled Mixed, and opened as
   * fifty Complex questions. Null where there is nothing to check yet.
   */
  const blendCheck = useMemo(
    () =>
      wantsBlend && source === 'bank' && effectiveCount > 0 && matchingQuestions.length > 0
        ? pickByBlend(matchingQuestions as any[], effectiveCount)
        : null,
    [wantsBlend, source, effectiveCount, matchingQuestions],
  );
  const blendNotice = blendCheck && !blendCheck.exact ? explainBlendShortfall(blendCheck, effectiveCount) : null;

  /** What the summaries say the paper's difficulty is. */
  const summaryDifficulty = wantsBlend
    ? blendNotice && blendCheck
      ? describeBlend(blendCheck.taken)
      : `Auto blend ${FULL_PAPER_BLEND.easy} / ${FULL_PAPER_BLEND.medium} / ${FULL_PAPER_BLEND.hard}`
    : difficulty;

  /** Which of the chosen groups a bank question falls in. One pass per question, not one per group. */
  const classifyGroups = (q: any): string[] =>
    unitMode ? unitIdsOf(tnpscStage, q) : groups.filter(g => g.test(q)).map(g => g.key);

  /**
   * What the weights ask of each group against what the bank holds for it, for a paper that is
   * built to the exam's split. Cheap, so it can be shown while the weights are being edited:
   * a unit the bank cannot fill is better seen here than found in the finished paper.
   */
  const compositionPlan = useMemo(
    () =>
      wantsBlend && source === 'bank' && groups.length > 1 && effectiveCount > 0
        ? planGroups(matchingQuestions as any[], groups, classifyGroups, subjectWeights, effectiveCount)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wantsBlend, source, groups, matchingQuestions, subjectWeights, effectiveCount, unitMode, tnpscStage],
  );
  const shortGroups = compositionPlan.filter(p => p.available < p.wanted);

  // ── Submit ──
  const handleCreate = async () => {
    let qIds: string[] = [];
    let maxScore = 0;
    /** The question objects behind `qIds` — their own difficulty is authoritative. */
    let chosen: any[] = [];
    /** True once a bank paper has been built to the exam's split and blend in one step. */
    let composed = false;

    if (source === 'paper' && paperIds.length > 0) {
      if (shuffleQuestions) {
        // Shuffle: send ALL questions from each paper as the pool
        const allPaperQs: any[] = [];
        for (const pid of paperIds) {
          const paperQs = await api.get<any[]>(`/api/v1/evaluation/papers/${pid}/questions`);
          allPaperQs.push(...(paperQs || []));
        }
        qIds = allPaperQs.map((q: any) => q.id);
        chosen = allPaperQs;
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
        chosen = picked;
        maxScore = picked.reduce((s: number, q: any) => s + (q.points || 1), 0);
      }
    } else if (wantsBlend && groups.length >= 1) {
      /*
       * A whole paper — a mock, a section, a Full Unit — is built to the exam's split first
       * (each unit gets its published share) and to the 20/30/50 blend *inside* each unit.
       * Applying the blend to the whole pool at once ignored the units: a Group 4 mock came
       * out as 172 Aptitude and 28 Tamil, with no General Studies. See `compose-pool.ts`.
       */
      const built = composeByGroups(
        matchingQuestions as any[],
        groups.map(g => ({ key: g.key, label: g.label, cluster: g.cluster })),
        classifyGroups,
        subjectWeights,
        effectiveCount,
        { blend: true },
      );
      chosen = built.picked;
      qIds = built.picked.map((q: any) => q.id);
      maxScore = built.picked.reduce((sum: number, q: any) => sum + (q.points || 1), 0);
      composed = true;

      if (built.short.length > 0) {
        toast.warning(
          `The bank is short in ${built.short.map(p => `${p.label} (${p.available} of ${p.wanted})`).join(', ')}. ` +
            `The gap was made up from the rest of the same section where it could be.`,
          { duration: 15_000 },
        );
      }
      if (built.unfilled > 0) {
        toast.warning(`Only ${built.picked.length} of ${effectiveCount} questions could be placed — every pool ran out.`);
      }
      const spread = difficultySpread(built.picked);
      const target = blendTargets(built.picked.length);
      const slack = groups.length + 1; // rounding inside each group can move a band by a question
      if ((['easy', 'medium', 'hard'] as QuestionDifficulty[]).some(b => Math.abs(spread[b] - target[b]) > slack)) {
        toast.warning(
          `The mix came out ${describeBlend({ easy: spread.easy, medium: spread.medium, hard: spread.hard })}, ` +
            `not the ${describeBlend(target)} asked for — the bank is short at some difficulty.`,
          { duration: 15_000 },
        );
      }
    } else if (groups.length > 1) {
      if (shuffleQuestions) {
        // Shuffle: send ALL matching questions as the pool
        qIds = (matchingQuestions as any[]).map((q: any) => q.id);
        chosen = matchingQuestions as any[];
        const totalMarks = (matchingQuestions as any[]).reduce((s: number, q: any) => s + (q.points || 1), 0);
        maxScore = qIds.length > 0 ? Math.round((totalMarks / qIds.length) * effectiveCount * 100) / 100 : effectiveCount;
      } else {
        // Constant: fixed questions per unit (or subject) according to weights.
        // A question that fits two groups is taken once.
        const allocation = distributeQuestions(effectiveCount, subjectWeights);
        const picked: any[] = [];
        const taken = new Set<string>();
        for (const g of groups) {
          const wanted = allocation[g.key] || 0;
          if (wanted === 0) continue;
          const groupPool = (matchingQuestions as any[]).filter((q: any) => g.test(q) && !taken.has(q.id));
          for (const q of groupPool.slice(0, wanted)) {
            taken.add(q.id);
            picked.push(q);
          }
        }
        qIds = picked.map((q: any) => q.id);
        chosen = picked;
        maxScore = picked.reduce((s: number, q: any) => s + (q.points || 1), 0);
      }
    } else {
      if (shuffleQuestions) {
        // Shuffle: send ALL matching questions as the pool
        qIds = (matchingQuestions as any[]).map((q: any) => q.id);
        chosen = matchingQuestions as any[];
        const totalMarks = (matchingQuestions as any[]).reduce((s: number, q: any) => s + (q.points || 1), 0);
        maxScore = qIds.length > 0 ? Math.round((totalMarks / qIds.length) * effectiveCount * 100) / 100 : effectiveCount;
      } else {
        // Constant: fixed set of effectiveCount questions
        const picked = matchingQuestions.slice(0, effectiveCount);
        qIds = picked.map((q: any) => q.id);
        chosen = picked;
        maxScore = picked.reduce((s: number, q: any) => s + (q.points || 1), 0);
      }
    }

    if (qIds.length === 0) {
      toast.error('No questions available to create assessment');
      return;
    }

    /**
     * A paper standing for the whole of something is composed, not sliced.
     *
     * A Full Unit set, a section set and every mock have to span the difficulty
     * range the real exam spans — taking the first N questions off a pool gives
     * whatever the pool happened to be ordered by, which for an imported paper is
     * usually one difficulty throughout. A paper pitched at a single level is
     * left alone: that one *should* be all Simple.
     */
    if (wantsBlend && chosen.length > 0 && !composed) {
      const blended = pickByBlend(chosen, effectiveCount);
      chosen = blended.picked;
      qIds = blended.picked.map((q: any) => q.id);
      maxScore = blended.picked.reduce((sum: number, q: any) => sum + (q.points || 1), 0);

      if (!blended.exact) {
        // The bank could not supply the mix: a gap in the question bank, and the paper
        // about to be built is skewed by it. Say so before it exists, not in a toast
        // after — and let the admin walk away from it.
        const go = window.confirm(`${explainBlendShortfall(blended, blended.picked.length)}

Create it anyway?`);
        if (!go) return;
      }
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

    // A paper made as a pool says so, and states the rule — so the server can draw each attempt
    // from the bank as it is then, not from the list of ids as they were today.
    const pool = describePool({
      source,
      shuffle: shuffleQuestions,
      composed: wantsBlend,
      stageId: tnpscTag.stage_id,
      unitIds: unitMode ? selectedUnits.map(u => u.id) : undefined,
      paperIds,
      difficulty: wantedDifficulty,
      questionTypes: selectedTypes,
      sourceType: effectiveSourceFilter,
      // The subjects and topics the paper holds — how a question added by hand, which has no unit,
      // finds the paper its neighbours are in.
      questions: chosen,
    });

    const result = await createAssessment.mutateAsync({
      title,
      testType: testType || undefined,
      // TNPSC placement — sent at create; also PATCHed below for backends that
      // don't yet accept the tags inline.
      tnpscStageId: tnpscTag.stage_id ?? undefined,
      track: tnpscTag.track ?? undefined,
      tnpscLevel: tnpscTag.track === 'mock' ? tnpscTag.level ?? undefined : undefined,
      tnpscSubjectId: tnpscTag.track === 'practice' ? tnpscTag.subject_id ?? undefined : undefined,
      // The id within the chosen unit — see 	opicIdForUnit; the bare category name can match another unit's topic.
      tnpscTopicId:
        tnpscTag.track === 'practice' && tnpscTag.scope === 'topic'
          ? topicIdForUnit(tnpscStage, tnpscTag.unit_id, tnpscTag.topic_id) ?? undefined
          : undefined,
      tnpscUnitId:
        tnpscTag.scope === 'unit' || tnpscTag.scope === 'topic' ? tnpscTag.unit_id ?? undefined : undefined,
      // A key topic is saved as a unit paper that names its topic (see `TnpscScope`).
      tnpscScope: (tnpscTag.scope === 'topic' ? 'unit' : tnpscTag.scope) ?? undefined,
      tnpscSectionName: tnpscTag.scope === 'section' ? tnpscTag.section_name ?? undefined : undefined,
      tnpscLanguage: tnpscTag.track === 'mock' ? tnpscTag.language ?? undefined : undefined,
      paperId: source === 'paper' && paperIds.length === 1 ? paperIds[0] : undefined,
      paperIds: source === 'paper' && paperIds.length > 1 ? paperIds : undefined,
      paperWeights: source === 'paper' && paperIds.length > 1 ? paperWeights : undefined,
      difficulty: difficultyOf(chosen, difficulty),
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
      poolMode: pool.mode,
      poolFilter: pool.filter,
      // The server draws a shuffled paper by subject, so unit weights are folded down to
      // subjects for it — and sent as they are too, for the day it can use them
      // (BACKEND_WORK.md item 14).
      subjectWeights:
        source === 'paper' || groups.length < 2
          ? undefined
          : unitMode
            ? subjectWeightsFromUnits(
                subjectWeights,
                Object.fromEntries(groups.map(g => [g.key, (matchingQuestions as any[]).filter(g.test)])),
              )
            : subjectWeights,
      unitIds: unitMode && selectedUnits.length > 0 ? selectedUnits.map(u => u.id) : undefined,
      unitWeights: unitMode && selectedUnits.length > 1 ? subjectWeights : undefined,
      pricingType,
      price: pricingType === 'paid' ? price : undefined,
      promoCode: pricingType === 'paid' && promoCode.trim() ? promoCode.trim().toUpperCase() : undefined,
      promoDiscountPct: pricingType === 'paid' && promoCode.trim() ? promoDiscountPct : undefined,
    });

    // Confirm the TNPSC placement. Non-fatal: the assessment exists either way,
    // but until it is tagged it will not appear under any group/stage.
    try {
      const { topicInTitleOnly } = await tagAssessmentKeepingTopic(result.id, tnpscTag);
      if (topicInTitleOnly) {
        toast.info(
          `Placed under the unit. The server has no such topic under that subject yet, so “${title}” carries the key topic in its title — keep the “Unit: Topic” part of the title as it is.`,
          { duration: 20_000 },
        );
      }
    } catch (err: any) {
      // The old message always blamed a missing endpoint, whatever had actually
      // failed. Say what the server said.
      toast.warning(
        `Assessment created, but the TNPSC placement (${describeTag(tnpscTag)}) could not be saved. ` +
          describeTagError(err, tnpscTag),
        { duration: 20_000 },
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
            <Field
              label="Assessment Title"
              required
              hint={
                suggestedTitle
                  ? 'Named from the placement below. Edit it and it stays as you leave it.'
                  : 'Fills in once you set the TNPSC placement below.'
              }
            >
              <Input
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  setTitleEdited(true);
                }}
                placeholder={suggestedTitle ?? 'Set the placement below, or type a name'}
                className="h-10"
              />
              {titleEdited && suggestedTitle && title !== suggestedTitle && (
                <button
                  type="button"
                  onClick={() => {
                    setTitle(suggestedTitle);
                    setTitleEdited(false);
                  }}
                  className="mt-1.5 text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Use the suggested name — {suggestedTitle}
                </button>
              )}
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

            {/* No difficulty picker. The placement below already says what the paper is: a
                unit pitched at one level takes that level from its difficulty button, and a
                full mock, a section or a Full Unit is composed to the 20/30/50 blend. A
                second "default" here could only disagree with it. */}

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
                  categoryOptions={categoryOptions}
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
                      // Units are kept: they are the exam's, not the source's, and the
                      // placement may already have chosen one for this paper.
                      setPickedSubjects([]);
                      setSelectedChapters([]);
                    }}
                    className={cn(
                      'flex flex-col items-center justify-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition-all',
                      sourceType === opt.value
                        ? 'border-brand-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-brand-300 ring-1 ring-brand-500/30'
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
                    {unitMode ? (
                      <Field
                        label="Units"
                        required
                        hint="The published syllabus units. Questions are drawn from the bank by each unit’s subject and topic."
                      >
                        <UnitPoolPicker
                          stage={tnpscStage}
                          units={stageUnitList}
                          selectedIds={selectedUnitIds}
                          onToggle={toggleUnit}
                          onSet={applyUnits}
                          // While the bank loads every unit would read "none in bank", which is false.
                          counts={bankLoading ? null : unitCounts}
                          onShowMapping={() => setMappingOpen(true)}
                        />
                        {bankLoading && (
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading the question bank — it is large, so this can take a minute.
                          </p>
                        )}
                      </Field>
                    ) : (
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
                            <>
                              {examSubjectOptions.map((s: string) => (
                                <label key={s} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer text-sm">
                                  <Checkbox checked={selectedSubjects.includes(s)} onCheckedChange={() => toggleSubject(s)} />
                                  {s}
                                </label>
                              ))}
                              {examSubjects.length > 0 && offExamCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setShowAllSubjects(v => !v)}
                                  className="mt-1 w-full rounded px-2 py-1.5 text-left text-[11px] text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  {showAllSubjects
                                    ? `Show only ${testType} subjects`
                                    : `${offExamCount} more in the bank, not examined by ${testType} — show anyway`}
                                </button>
                              )}
                            </>
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
                    )}

                    {chapterSuggestions.length > 0 && (
                      <Field
                        label="Chapters"
                        hint={
                          emptyChapterCount > 0
                            ? `Optional — leave empty to pull from all. ${emptyChapterCount} in the syllabus have no questions in the bank yet.`
                            : 'Optional — leave empty to pull from all chapters.'
                        }
                      >
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
                            {chapterSuggestions.map(c => (
                              <label
                                key={c.name}
                                className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Checkbox
                                  checked={selectedChapters.includes(c.name)}
                                  onCheckedChange={() => toggleChapter(c.name)}
                                />
                                <span className={cn('flex-1 truncate', !c.inBank && 'text-muted-foreground')}>
                                  {c.name}
                                </span>
                                {/* Selecting one of these returns nothing — the
                                    syllabus names it, the bank has none of it. */}
                                {!c.inBank && (
                                  <span className="shrink-0 text-[10px] text-muted-foreground">
                                    none yet
                                  </span>
                                )}
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
                      hint={
                        availableCount > 0
                          ? `${availableCount} question${availableCount === 1 ? '' : 's'} available in the bank with this combination`
                          : selectedSubjects.length === 0
                            ? `No matching questions yet — pick ${unitMode ? 'units' : 'subjects'} first`
                            : subjectPool.length === 0
                              ? unitMode
                                ? 'The bank has no questions in the selected units.'
                                : `The bank has no questions tagged ${selectedSubjects.join(', ')}.`
                              : 'Nothing matches this combination — see below.'
                      }
                    >
                      {unitMode && selectedUnits.length > 0 && subjectPool.length === 0 && (
                        <UnitPoolDiagnosis
                          loading={bankLoading}
                          error={bankError ? ((bankErr as Error)?.message || 'The request failed.') : null}
                          onRetry={() => refetchBank()}
                          bank={bankQuestions as any[]}
                          sourceType={sourceType}
                        />
                      )}
                      {blendNotice && (
                        <p className="mb-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                          {blendNotice}
                        </p>
                      )}
                      {availableCount === 0 && subjectPool.length > 0 && wantedDifficulty && (
                        <PoolExplainer
                          pool={subjectPool}
                          wanted={wantedDifficulty}
                          noun={unitMode ? (selectedUnits.length > 1 ? 'selection' : 'unit') : 'subject'}
                          onShowMapping={unitMode ? () => setMappingOpen(true) : undefined}
                          onUseAny={() => setAnyDifficulty(true)}
                        />
                      )}
                      <Slider
                        value={[questionCount]}
                        onValueChange={([v]) => setQuestionCount(v)}
                        min={1}
                        max={Math.max(availableCount, 1)}
                        step={1}
                        className="mt-2"
                      />
                    </Field>

                    {groups.length >= 2 && (
                      <Field
                        label={unitMode ? 'Unit Weightage' : 'Subject Weightage'}
                        hint={
                          unitMode
                            ? 'How questions are distributed across the chosen units — set to the published split. Must total 100%.'
                            : 'How questions are distributed across the chosen subjects. Must total 100%.'
                        }
                      >
                        <WeightageEditor
                          items={groups.map(g => ({ key: g.key, label: g.label }))}
                          weights={subjectWeights}
                          onChange={setSubjectWeights}
                        />
                        {shortGroups.length > 0 && (
                          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                            <p className="font-semibold">The bank cannot fill every share of a {effectiveCount}-question paper:</p>
                            <ul className="mt-1 space-y-0.5">
                              {shortGroups.map(p => (
                                <li key={p.key}>
                                  {p.label} — asked for {p.wanted}, the bank has {p.available}
                                </li>
                              ))}
                            </ul>
                            <p className="mt-1 opacity-90">
                              The gap is made up from the other units of the same section, so the section totals hold.
                            </p>
                          </div>
                        )}
                        {unitMode && (
                          <button
                            type="button"
                            onClick={() => setSubjectWeights(unitWeightsFromSyllabus(selectedUnits))}
                            className="mt-2 text-xs text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Reset to the published split
                          </button>
                        )}
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
              difficulty={summaryDifficulty}
              source={source}
              sourceType={sourceType}
              papers={paperIds.map(id => {
                const p = (papers as any[]).find((x: any) => x.id === id);
                return { id, title: p?.title || id };
              })}
              paperWeights={paperWeights}
              subjects={groups.map(g => g.label)}
              subjectWeights={Object.fromEntries(groups.map(g => [g.label, subjectWeights[g.key]]))}
              subjectsLabel={unitMode ? 'Units' : 'Subjects'}
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

      <UnitMappingDialog
        open={mappingOpen}
        onOpenChange={setMappingOpen}
        stage={tnpscStage}
        questions={bankQuestions as any[]}
        papers={papers as any[]}
      />

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
            difficulty={summaryDifficulty}
            source={source}
            sourceType={sourceType}
            papers={paperIds.map(id => {
              const p = (papers as any[]).find((x: any) => x.id === id);
              return { id, title: p?.title || id };
            })}
            paperWeights={paperWeights}
            subjects={groups.map(g => g.label)}
            subjectWeights={Object.fromEntries(groups.map(g => [g.label, subjectWeights[g.key]]))}
            subjectsLabel={unitMode ? 'Units' : 'Subjects'}
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
                  isCurrent && 'border-brand-600 bg-brand-600 text-white ring-4 ring-blue-100 dark:ring-blue-950/60',
                  isPast && 'border-brand-600 bg-brand-600 text-white',
                  !isCurrent && !isPast && 'border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500'
                )}
              >
                {isPast ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span
                className={cn(
                  'text-[11px] font-medium uppercase tracking-wider',
                  isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
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
                    i < currentIndex ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'
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
          ? 'border-brand-500 bg-blue-50/60 dark:bg-blue-950/30 ring-1 ring-brand-500/30'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
      )}
    >
      <div className={cn('flex items-center gap-2', description && 'mb-1')}>
        <span className={cn('flex items-center justify-center w-6 h-6 rounded-md', active ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500')}>
          {icon}
        </span>
        <p className={cn('text-sm font-semibold', active ? 'text-blue-700 dark:text-brand-300' : 'text-slate-800 dark:text-slate-200')}>
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
          ? 'border-brand-500 bg-blue-50/60 text-blue-700 dark:bg-blue-950/30 dark:text-brand-300 ring-1 ring-brand-500/30'
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
  /** What `subjects` are called — "Units" where the pool is drawn by syllabus unit. */
  subjectsLabel?: string;
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
          label={props.subjectsLabel ?? 'Subjects'}
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
          ? `${props.sourceType === 'all' ? 'Any' : props.sourceType.charAt(0).toUpperCase() + props.sourceType.slice(1)}${props.subjects.length > 0 ? ' · ' + props.subjects.length + (props.subjectsLabel === 'Units' ? ' units' : ' subj') : ''}`
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
