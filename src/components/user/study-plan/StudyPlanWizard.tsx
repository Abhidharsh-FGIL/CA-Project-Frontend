/**
 * The study-plan intake — four steps, then the server builds the plan.
 *
 * The wizard collects answers and nothing else. It does not estimate whether the
 * answers are achievable, how many weeks they amount to, or what will be studied:
 * step 4 asks the server (`POST study-plan/feasibility`) and renders the verdict
 * it gets back, including the fixes it offers. That is the whole point of putting
 * generation server-side — the one place that knows the syllabus volume is the
 * one place that judges whether your evenings cover it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock,
  Flag,
  Loader2,
  Sparkles,
  Target,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCENT, ReportCard, StatTile } from '@/components/user/report-ui';
import {
  WEEKDAYS,
  WEEKDAY_LABEL,
  WEEKDAY_SHORT,
  type BasisKind,
  type HorizonMode,
  type IntakeOptions,
  type RevisionIntensity,
  type StudyPlanIntake,
  type Verdict,
  type Weekday,
} from '@/lib/studyPlanApi';
import { useFeasibility } from '@/hooks/use-study-plan';
import { PanelHeader, VERDICT, VerdictPill, fmtDate, fmtHours, fmtMinutes, todayISO } from './plan-ui';

/** The selected-state ring shared by the wizard's choice cards. */
const CHOSEN = 'border-blue-300 bg-blue-50/70 ring-1 ring-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:ring-blue-900/50';
const UNCHOSEN = 'border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900 hover:border-blue-200 dark:hover:border-blue-900';

type Step = 0 | 1 | 2 | 3;

const STEPS: Array<{ title: string; blurb: string }> = [
  { title: 'How long', blurb: 'The runway you have before the exam' },
  { title: 'Your week', blurb: 'Which days you study, and for how long' },
  { title: 'Starting point', blurb: 'What we build the plan around' },
  { title: 'Check it fits', blurb: 'Before we build anything' },
];

/**
 * A horizon the user can pick. `verdict` is present only once the server has
 * judged it — the fallbacks below are offered before `intake-options` answers and
 * carry no verdict, because nothing here knows the syllabus volume.
 */
interface HorizonChoice {
  mode: HorizonMode;
  value: number;
  label: string;
  verdict?: Verdict;
}

/** Fallback horizons, used only until `intake-options` answers. */
const FALLBACK_HORIZONS: HorizonChoice[] = [
  { mode: 'days', value: 30, label: '1 month' },
  { mode: 'months', value: 3, label: '3 months' },
  { mode: 'months', value: 6, label: '6 months' },
  { mode: 'months', value: 12, label: '1 year' },
];

const INTENSITY: Array<{ value: RevisionIntensity; label: string; blurb: string }> = [
  { value: 'light', label: 'Light', blurb: 'Two revisits per topic' },
  { value: 'balanced', label: 'Balanced', blurb: 'Three revisits — recommended' },
  { value: 'heavy', label: 'Heavy', blurb: 'Four revisits, less new ground' },
];

export function StudyPlanWizard({
  groupId,
  stageId,
  options,
  onSubmit,
  submitting,
  onCancel,
}: {
  groupId: string;
  stageId: string;
  options: IntakeOptions | null;
  onSubmit: (intake: StudyPlanIntake) => void;
  submitting?: boolean;
  onCancel?: () => void;
}) {
  const [step, setStep] = useState<Step>(0);

  // ── Answers ────────────────────────────────────────────────────────────────
  const [horizonMode, setHorizonMode] = useState<HorizonMode>('months');
  const [horizonValue, setHorizonValue] = useState(6);
  const [examDate, setExamDate] = useState<string>('');
  const [studyDays, setStudyDays] = useState<Weekday[]>(['mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
  const [minutesPerDay, setMinutesPerDay] = useState(180);
  const [perDay, setPerDay] = useState<Partial<Record<Weekday, number>>>({});
  const [intensity, setIntensity] = useState<RevisionIntensity>('balanced');
  const [includeMocks, setIncludeMocks] = useState(true);
  const [basisKind, setBasisKind] = useState<BasisKind>('cold_start');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [optionalSubjects, setOptionalSubjects] = useState<string[]>([]);
  const [highYield, setHighYield] = useState(false);

  const feas = useFeasibility();

  // Seed from the server's own suggestions once they land, so the wizard opens on
  // sensible defaults for *this* exam rather than on 3 hours a day for everything.
  useEffect(() => {
    if (!options) return;
    setMinutesPerDay(options.suggested_minutes_per_day);
    if (options.known_exam_date) setExamDate(options.known_exam_date);
    const preferred = options.suggested_horizons.find(h => h.verdict === 'comfortable');
    if (preferred) {
      setHorizonMode(preferred.mode);
      setHorizonValue(preferred.value);
    }
    if (options.attempts_available > 0 && options.latest_attempt) {
      setBasisKind(options.attempts_available > 2 ? 'progress' : 'attempt');
      setAttemptId(options.latest_attempt.attempt_id);
    }
    // One option per mutually-exclusive group is pre-chosen; the user can switch.
    setOptionalSubjects(
      options.optional_subject_groups
        .map(g => g.options[0]?.subject_id)
        .filter((id): id is string => !!id),
    );
  }, [options]);

  const intake = useMemo<StudyPlanIntake>(() => {
    const basis: StudyPlanIntake['basis'] = { kind: basisKind };
    // `basis.facts` (the §S6.1 shim) is attached by the page just before the
    // POST, because resolving it needs a network call the wizard must not block on.
    if (basisKind === 'attempt' && attemptId) basis.attempt_id = attemptId;
    return {
      group_id: groupId,
      stage_id: stageId,
      basis,
      horizon: { mode: horizonMode, value: horizonValue },
      start_date: todayISO(),
      exam_date: examDate || null,
      study_days: WEEKDAYS.filter(d => studyDays.includes(d)),
      minutes_per_day: minutesPerDay,
      per_day_minutes: Object.keys(perDay).length ? perDay : undefined,
      revision_intensity: intensity,
      include_full_mocks: includeMocks,
      coverage_mode: highYield ? 'high_yield' : 'full',
      optional_subjects: optionalSubjects.length ? optionalSubjects : undefined,
    };
  }, [
    groupId, stageId, basisKind, attemptId, horizonMode, horizonValue,
    examDate, studyDays, minutesPerDay, perDay, intensity, includeMocks, highYield,
    optionalSubjects,
  ]);

  /** Entering the last step is what triggers the check — not every slider move. */
  const goToStep = useCallback(
    (next: Step) => {
      setStep(next);
      if (next === 3) void feas.check(intake);
    },
    [feas, intake],
  );

  /** A suggestion is a partial intake the server composed. Apply it, re-check. */
  const applyPatch = useCallback(
    (patch: Partial<StudyPlanIntake>) => {
      if (patch.minutes_per_day != null) setMinutesPerDay(patch.minutes_per_day);
      if (patch.study_days) setStudyDays(patch.study_days);
      if (patch.horizon) {
        setHorizonMode(patch.horizon.mode);
        setHorizonValue(patch.horizon.value);
      }
      if (patch.coverage_mode) setHighYield(patch.coverage_mode === 'high_yield');
      if (patch.per_day_minutes) setPerDay(patch.per_day_minutes);
      void feas.check({ ...intake, ...patch });
    },
    [feas, intake],
  );

  const toggleDay = (d: Weekday) =>
    setStudyDays(prev => {
      const next = prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d];
      // At least one study day, or there is no plan to make.
      return next.length ? next : prev;
    });

  const weeklyMinutes = studyDays.reduce((n, d) => n + (perDay[d] ?? minutesPerDay), 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
          <Wand2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold leading-tight text-gray-900 dark:text-gray-100 sm:text-2xl">
            Build your study plan
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {options?.stage_name ?? 'Answer four questions and we build the rest'}
          </p>
        </div>
      </div>
      <StepRail step={step} onPick={s => (s < step ? goToStep(s) : undefined)} />

      {step === 0 && (
        <HorizonStep
          options={options}
          mode={horizonMode}
          value={horizonValue}
          examDate={examDate}
          onMode={setHorizonMode}
          onValue={setHorizonValue}
          onExamDate={setExamDate}
        />
      )}

      {step === 1 && (
        <ScheduleStep
          studyDays={studyDays}
          minutesPerDay={minutesPerDay}
          perDay={perDay}
          weeklyMinutes={weeklyMinutes}
          intensity={intensity}
          includeMocks={includeMocks}
          onToggleDay={toggleDay}
          onMinutes={setMinutesPerDay}
          onPerDay={setPerDay}
          onIntensity={setIntensity}
          onIncludeMocks={setIncludeMocks}
        />
      )}

      {step === 2 && (
        <BasisStep
          options={options}
          basisKind={basisKind}
          attemptId={attemptId}
          optionalSubjects={optionalSubjects}
          onBasis={setBasisKind}
          onAttempt={setAttemptId}
          onOptionalSubjects={setOptionalSubjects}
        />
      )}

      {step === 3 && (
        <FeasibilityStep
          feas={feas}
          intake={intake}
          onApply={applyPatch}
          onRecheck={() => void feas.check(intake)}
        />
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (step === 0 ? onCancel?.() : goToStep((step - 1) as Step))}
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800/60"
        >
          <ArrowLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={() => goToStep((step + 1) as Step)}
            className="inline-flex h-11 min-w-[8.5rem] items-center justify-center gap-2 rounded-xl bg-brand-500 px-7 text-sm font-bold text-white shadow-sm hover:bg-brand-600"
          >
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting || feas.isChecking}
            onClick={() => onSubmit(intake)}
            className="inline-flex h-11 min-w-[10rem] items-center justify-center gap-2 rounded-xl bg-brand-500 px-7 text-sm font-bold text-white shadow-sm hover:bg-brand-600 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Building…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Build my plan
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step rail ────────────────────────────────────────────────────────────────

function StepRail({ step, onPick }: { step: Step; onPick: (s: Step) => void }) {
  return (
    <ol className="grid grid-cols-4 gap-2 sm:gap-3">
      {STEPS.map((s, i) => {
        const state = i === step ? 'current' : i < step ? 'done' : 'todo';
        return (
          <li key={s.title} className="min-w-0">
            <button
              type="button"
              onClick={() => onPick(i as Step)}
              disabled={state === 'todo'}
              aria-current={state === 'current' ? 'step' : undefined}
              className={cn(
                'flex h-full w-full flex-col gap-2 rounded-xl border p-2.5 text-center shadow-sm transition-colors sm:flex-row sm:items-start sm:gap-3 sm:p-3 sm:text-left',
                state === 'current' && 'border-blue-200 bg-blue-50/80 dark:border-blue-800 dark:bg-blue-950/30',
                state === 'done' &&
                  'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20',
                state === 'todo' && 'cursor-default border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
              )}
            >
              <span
                className={cn(
                  'mx-auto flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold sm:mx-0',
                  state === 'current' && 'bg-blue-600 text-white',
                  state === 'done' && 'bg-emerald-500 text-white',
                  state === 'todo' && 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                )}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block truncate text-[13px] font-bold sm:text-[14px]',
                    state === 'current' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-100',
                  )}
                >
                  {s.title}
                </span>
                {/* A finished step keeps its title and a quiet line; the blurb is for what is ahead. */}
                {state === 'done' ? (
                  <span className="mt-2 hidden h-1 rounded-full bg-emerald-200/80 dark:bg-emerald-800/60 sm:block" />
                ) : (
                  <span className="mt-0.5 hidden text-[12px] leading-snug text-gray-400 dark:text-gray-500 sm:block">
                    {s.blurb}
                  </span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Step 1: horizon ──────────────────────────────────────────────────────────

function HorizonStep({
  options,
  mode,
  value,
  examDate,
  onMode,
  onValue,
  onExamDate,
}: {
  options: IntakeOptions | null;
  mode: HorizonMode;
  value: number;
  examDate: string;
  onMode: (m: HorizonMode) => void;
  onValue: (v: number) => void;
  onExamDate: (d: string) => void;
}) {
  const horizons: HorizonChoice[] = options?.suggested_horizons ?? FALLBACK_HORIZONS;

  return (
    <ReportCard className="sm:p-6">
      <PanelHeader
        icon={<CalendarDays className="w-4 h-4" />}
        title="How long do you have?"
        subtitle="Pick a length, or give us the exam date and we work backwards"
      />

      <div className={cn('grid gap-3', horizons.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
        {horizons.map(h => {
          const active = mode === h.mode && value === h.value;
          return (
            <button
              key={`${h.mode}-${h.value}`}
              type="button"
              onClick={() => {
                onMode(h.mode);
                onValue(h.value);
              }}
              className={cn('rounded-xl border px-2 py-5 text-center shadow-sm transition-colors sm:px-3', active ? CHOSEN : UNCHOSEN)}
            >
              <p
                className={cn(
                  'text-base font-bold',
                  active ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-100',
                )}
              >
                {h.label}
              </p>
              {/* The server's verdict, said in words — colour alone never carries it. */}
              {h.verdict && (
                <p className={cn('mt-2 text-[13px] font-semibold', ACCENT[VERDICT[h.verdict].accent].text)}>
                  {VERDICT[h.verdict].label}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid sm:grid-cols-2 gap-5">
        <label className="block">
          <span className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">
            Or an exact number of days
          </span>
          <input
            type="number"
            min={7}
            max={730}
            value={mode === 'days' ? value : ''}
            placeholder="e.g. 45"
            onChange={e => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) {
                onMode('days');
                onValue(n);
              }
            }}
            className="mt-1.5 h-12 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 text-sm tabular-nums placeholder:text-gray-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
          />
        </label>

        <label className="block">
          <span className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">
            Exam date <span className="font-normal text-gray-400">(optional)</span>
          </span>
          <input
            type="date"
            value={examDate}
            onChange={e => onExamDate(e.target.value)}
            className="mt-1.5 h-12 w-full rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
          />
          <span className="mt-1 block text-[13px] text-gray-400 leading-snug">
            Given a date, the last phase becomes a final sprint that ends on it — and nothing is
            scheduled after it.
          </span>
        </label>
      </div>

      {options && (
        <p className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 text-[13px] text-gray-400 leading-relaxed">
          {options.stage_name} has {options.subject_count} subjects and {options.topic_count} topics,
          worth {options.total_marks} marks. We estimate{' '}
          {fmtHours(options.estimated_syllabus_minutes)} of study to cover it once.
        </p>
      )}
    </ReportCard>
  );
}

// ─── Step 2: the week ─────────────────────────────────────────────────────────

function ScheduleStep({
  studyDays,
  minutesPerDay,
  perDay,
  weeklyMinutes,
  intensity,
  includeMocks,
  onToggleDay,
  onMinutes,
  onPerDay,
  onIntensity,
  onIncludeMocks,
}: {
  studyDays: Weekday[];
  minutesPerDay: number;
  perDay: Partial<Record<Weekday, number>>;
  weeklyMinutes: number;
  intensity: RevisionIntensity;
  includeMocks: boolean;
  onToggleDay: (d: Weekday) => void;
  onMinutes: (m: number) => void;
  onPerDay: (p: Partial<Record<Weekday, number>>) => void;
  onIntensity: (i: RevisionIntensity) => void;
  onIncludeMocks: (b: boolean) => void;
}) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <ReportCard className="sm:p-6">
        <PanelHeader
          icon={<CalendarDays className="w-4 h-4" />}
          title="Which days will you study?"
          subtitle="Days you leave out become rest days — the plan never schedules work on them"
        />

        <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
          {WEEKDAYS.map(d => {
            const on = studyDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onToggleDay(d)}
                aria-pressed={on}
                className={cn(
                  'rounded-xl border py-3.5 text-center shadow-sm transition-colors',
                  on
                    ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
                    : 'border-gray-100 bg-gray-50 hover:bg-white dark:border-gray-800 dark:bg-gray-900/60',
                )}
              >
                <span
                  className={cn(
                    'block text-[14px] font-bold',
                    on ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400',
                  )}
                >
                  {WEEKDAY_SHORT[d]}
                </span>
                <span className={cn('mt-0.5 block text-[12px]', on ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400')}>
                  {on ? fmtMinutes(perDay[d] ?? minutesPerDay) : 'Rest'}
                </span>
              </button>
            );
          })}
        </div>
      </ReportCard>

      <ReportCard className="sm:p-6">
        <PanelHeader
          icon={<Clock className="w-4 h-4" />}
          title="How long each day?"
          subtitle="Be honest — a plan you meet beats one you abandon"
        />

        <input
          type="range"
          min={30}
          max={600}
          step={15}
          value={minutesPerDay}
          onChange={e => onMinutes(Number(e.target.value))}
          // The filled part of the track is drawn from the value, so the slider reads as progress.
          style={{ background: `linear-gradient(to right, #2f7fe0 ${((minutesPerDay - 30) / 570) * 100}%, var(--track) 0)` }}
          className={cn(
            'h-2 w-full cursor-pointer appearance-none rounded-full [--track:#e3eaf6] dark:[--track:#26324a]',
            '[&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white',
            '[&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-md',
            '[&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full',
            '[&::-moz-range-thumb]:border-[3px] [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-blue-600',
          )}
          aria-label="Minutes per study day"
        />
        <div className="mt-2 flex items-center justify-between text-[13px] text-gray-400">
          <span>30m</span>
          <span className="text-[15px] font-bold text-blue-600 dark:text-blue-400">
            {fmtMinutes(minutesPerDay)} a day
          </span>
          <span>10h</span>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            value={studyDays.length}
            label="Study days a week"
            accent="indigo"
            align="left"
          />
          <StatTile value={fmtMinutes(weeklyMinutes)} label="Each week" accent="slate" align="left" />
          <StatTile
            value={fmtHours(weeklyMinutes * 4.33)}
            label="Each month"
            accent="slate"
            align="left"
          />
          <StatTile
            value={includeMocks ? 'Included' : 'Excluded'}
            label="Full mocks"
            accent="rose"
            align="left"
          />
        </div>

        {/* Weekend-heavy schedules are common — one override per day covers it. */}
        <details className="mt-4 group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[14px] font-semibold text-blue-600 dark:text-blue-400 [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
            Set a different length for some days
          </summary>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {studyDays.map(d => (
              <label key={d} className="block">
                <span className="text-[13px] font-semibold text-gray-600 dark:text-gray-300">
                  {WEEKDAY_LABEL[d]}
                </span>
                <input
                  type="number"
                  min={30}
                  max={720}
                  step={15}
                  value={perDay[d] ?? ''}
                  placeholder={String(minutesPerDay)}
                  onChange={e => {
                    const n = Number(e.target.value);
                    const next = { ...perDay };
                    if (!e.target.value || Number.isNaN(n)) delete next[d];
                    else next[d] = n;
                    onPerDay(next);
                  }}
                  className="mt-0.5 w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1.5 text-[14px] tabular-nums"
                />
              </label>
            ))}
          </div>
        </details>
      </ReportCard>

      <ReportCard className="sm:p-6">
        <PanelHeader
          icon={<Target className="w-4 h-4" />}
          title="How much revision?"
          subtitle="Each topic comes back on a spaced schedule — this sets how often"
        />
        <div className="grid sm:grid-cols-3 gap-2">
          {INTENSITY.map(o => {
            const active = intensity === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onIntensity(o.value)}
                className={cn(
                  'rounded-xl border p-3 text-left transition-colors',
                  active
                    ? cn(ACCENT.violet.ring, ACCENT.violet.wash)
                    : 'border-gray-100 dark:border-gray-800 hover:border-violet-200 dark:hover:border-violet-900',
                )}
              >
                <p
                  className={cn(
                    'text-[13px] font-bold',
                    active ? ACCENT.violet.text : 'text-gray-800 dark:text-gray-100',
                  )}
                >
                  {o.label}
                </p>
                <p className="mt-0.5 text-[13px] text-gray-400 leading-snug">{o.blurb}</p>
              </button>
            );
          })}
        </div>

        <label className="mt-3 flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeMocks}
            onChange={e => onIncludeMocks(e.target.checked)}
            className="mt-0.5 accent-brand-600"
          />
          <span className="text-[14px] text-gray-700 dark:text-gray-200">
            Schedule full-length mocks at the end of each phase
            <span className="block text-[13px] text-gray-400">
              Timed, under exam conditions, with the next day set aside to mark it.
            </span>
          </span>
        </label>
      </ReportCard>
    </div>
  );
}

// ─── Step 3: basis ────────────────────────────────────────────────────────────

function BasisStep({
  options,
  basisKind,
  attemptId,
  optionalSubjects,
  onBasis,
  onAttempt,
  onOptionalSubjects,
}: {
  options: IntakeOptions | null;
  basisKind: BasisKind;
  attemptId: string | null;
  optionalSubjects: string[];
  onBasis: (b: BasisKind) => void;
  onAttempt: (id: string | null) => void;
  onOptionalSubjects: (ids: string[]) => void;
}) {
  const attempts = options?.attempts_available ?? 0;
  const latest = options?.latest_attempt ?? null;

  const choices: Array<{
    kind: BasisKind;
    label: string;
    blurb: string;
    disabled?: boolean;
  }> = [
    {
      kind: 'progress',
      label: 'All my recent mocks',
      blurb:
        'Weights the plan by weaknesses that persist across attempts, so one bad day does not distort it.',
      disabled: attempts < 2,
    },
    {
      kind: 'attempt',
      label: latest ? `My last mock — ${latest.test_name ?? 'most recent'}` : 'My last mock',
      blurb: latest
        ? `${fmtDate(latest.date)}${latest.percentage != null ? ` · ${latest.percentage}%` : ''}. Targets exactly what that paper exposed.`
        : 'Targets exactly what your most recent paper exposed.',
      disabled: attempts < 1,
    },
    {
      kind: 'cold_start',
      label: 'Start fresh',
      blurb:
        'No mock needed. We weight by the exam’s own mark distribution and open with short diagnostics, then re-tune the plan once results arrive.',
    },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      <ReportCard className="sm:p-6">
        <PanelHeader
          icon={<Flag className="w-4 h-4" />}
          title="What should we build the plan around?"
          subtitle="This decides which subjects get the most of your time"
        />

        <div className="space-y-2.5">
          {choices.map(c => {
            const active = basisKind === c.kind;
            return (
              <button
                key={c.kind}
                type="button"
                disabled={c.disabled}
                onClick={() => {
                  onBasis(c.kind);
                  if (c.kind === 'attempt') onAttempt(latest?.attempt_id ?? null);
                }}
                className={cn(
                  'w-full rounded-xl border p-4 text-left shadow-sm transition-colors',
                  active ? CHOSEN : UNCHOSEN,
                  c.disabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                <span className="flex items-center gap-3">
                  <Radio on={active} />
                  <span
                    className={cn(
                      'text-[15px] font-bold',
                      active ? 'text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-100',
                    )}
                  >
                    {c.label}
                  </span>
                </span>
                <span className="mt-1 block pl-8 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                  {c.disabled ? 'Available once you have sat a mock test.' : c.blurb}
                </span>
              </button>
            );
          })}
        </div>

        {basisKind === 'cold_start' && attempts > 0 && (
          <p className="mt-2.5 text-[13px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
            <AlertTriangle className="w-3 h-3 mt-px flex-shrink-0" />
            You have {attempts} mock{attempts === 1 ? '' : 's'} on record. Using them makes the plan
            noticeably sharper than starting fresh.
          </p>
        )}
      </ReportCard>

      {/* Group 4 sits General Tamil *or* General English — never both. */}
      {options && options.optional_subject_groups.length > 0 && (
        <ReportCard className="sm:p-6">
          <PanelHeader
            icon={<Target className="w-4 h-4" />}
            title="Which optional subject do you sit?"
            subtitle="The one you do not choose is left out of the plan entirely"
          />
          {options.optional_subject_groups.map((g, gi) => (
            <div key={gi} className="grid sm:grid-cols-2 gap-2">
              {g.options.map(o => {
                const active = optionalSubjects.includes(o.subject_id);
                return (
                  <button
                    key={o.subject_id}
                    type="button"
                    onClick={() =>
                      onOptionalSubjects([
                        ...optionalSubjects.filter(
                          id => !g.options.some(x => x.subject_id === id),
                        ),
                        o.subject_id,
                      ])
                    }
                    className={cn(
                      'flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[14px] font-semibold shadow-sm transition-colors',
                      active ? cn(CHOSEN, 'text-blue-700 dark:text-blue-300') : cn(UNCHOSEN, 'text-gray-700 dark:text-gray-200'),
                    )}
                  >
                    <Radio on={active} />
                    {o.name}
                  </button>
                );
              })}
            </div>
          ))}
        </ReportCard>
      )}
    </div>
  );
}

// ─── Step 4: feasibility ──────────────────────────────────────────────────────

function FeasibilityStep({
  feas,
  intake,
  onApply,
  onRecheck,
}: {
  feas: ReturnType<typeof useFeasibility>;
  intake: StudyPlanIntake;
  onApply: (patch: Partial<StudyPlanIntake>) => void;
  onRecheck: () => void;
}) {
  if (feas.isChecking) {
    return (
      <ReportCard className="sm:p-6">
        <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          Checking whether this fits the syllabus…
        </div>
      </ReportCard>
    );
  }

  // Feasibility lives on the server because only the server knows the syllabus
  // volume. With the endpoint absent we say so, rather than guessing a verdict.
  if (feas.unavailable) {
    return (
      <ReportCard className="sm:p-6">
        <PanelHeader
          icon={<AlertTriangle className="w-4 h-4" />}
          title="We can't check the fit yet"
          subtitle="Your answers are complete — go ahead and build"
          accent="amber"
        />
        <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed">
          The feasibility check runs on our servers and is not available on this account yet. Your
          plan will still be built from the answers you gave.
        </p>
        <IntakeRecap intake={intake} />
      </ReportCard>
    );
  }

  if (feas.error) {
    return (
      <ReportCard className="sm:p-6">
        <PanelHeader
          icon={<AlertTriangle className="w-4 h-4" />}
          title="The check failed"
          accent="rose"
          action={
            <button
              type="button"
              onClick={onRecheck}
              className="text-[14px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              Try again
            </button>
          }
        />
        <p className="text-[14px] text-gray-500 dark:text-gray-400">{feas.error.message}</p>
        <IntakeRecap intake={intake} />
      </ReportCard>
    );
  }

  const r = feas.result;
  if (!r) {
    return (
      <ReportCard className="sm:p-6">
        <IntakeRecap intake={intake} />
      </ReportCard>
    );
  }

  const v = VERDICT[r.verdict];

  return (
    <div className="space-y-3 sm:space-y-4">
      <ReportCard className="sm:p-6">
        <PanelHeader
          icon={<Target className="w-4 h-4" />}
          title="Does this fit?"
          subtitle={v.blurb}
          accent={v.accent}
          action={<VerdictPill verdict={r.verdict} />}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            value={fmtHours(r.available_minutes)}
            label="You have"
            hint={`${r.study_day_count} study days`}
            accent={v.accent}
            emphasis
          />
          <StatTile
            value={fmtHours(r.required_minutes)}
            label="Syllabus needs"
            hint="To cover it properly"
          />
          <StatTile
            value={r.shortfall_minutes > 0 ? fmtHours(r.shortfall_minutes) : 'None'}
            label="Shortfall"
            hint={r.shortfall_pct > 0 ? `${r.shortfall_pct}% short` : 'Fits as planned'}
            accent={r.shortfall_minutes > 0 ? 'rose' : 'emerald'}
          />
          <StatTile
            value={fmtMinutes(intake.minutes_per_day)}
            label="Each study day"
            hint={`${intake.study_days.length} days a week`}
            accent="indigo"
          />
        </div>

        <p className="mt-5 text-[14px] leading-relaxed text-gray-600 dark:text-gray-300">
          {r.message}
        </p>
      </ReportCard>

      {r.suggestions.length > 0 && (
        <ReportCard className="sm:p-6">
          <PanelHeader
            icon={<Wand2 className="w-4 h-4" />}
            title="Ways to make it fit"
            subtitle="Tap one to apply it and re-check"
            accent="amber"
          />
          <div className="grid sm:grid-cols-2 gap-2">
            {r.suggestions.map((s, i) => (
              <button
                key={`${s.kind}-${i}`}
                type="button"
                onClick={() => onApply(s.patch)}
                className="rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2.5 text-left text-[14px] font-semibold text-gray-700 dark:text-gray-200 hover:border-amber-300 dark:hover:border-amber-800 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors"
              >
                {s.label}
              </button>
            ))}
          </div>
        </ReportCard>
      )}

      {r.verdict === 'not_feasible' && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 p-4">
          <p className="text-[14px] font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> This plan will not cover the syllabus
          </p>
          <p className="mt-1 text-[14px] leading-relaxed text-rose-600 dark:text-rose-400">
            You can still build it — we will prioritise the highest-scoring material and say plainly
            what has been left out. Adjusting the time above is the better option if you can.
          </p>
        </div>
      )}
    </div>
  );
}

/** A radio mark — the choice cards are buttons, so this is drawn rather than an input. */
function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2',
        on ? 'border-blue-600' : 'border-gray-300 dark:border-gray-600',
      )}
    >
      {on && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
    </span>
  );
}

function IntakeRecap({ intake }: { intake: StudyPlanIntake }) {
  return (
    <dl className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-2 text-[14px]">
      {[
        ['Length', `${intake.horizon.value} ${intake.horizon.mode.replace('_', ' ')}`],
        ['Study days', intake.study_days.map(d => WEEKDAY_SHORT[d]).join(', ')],
        ['Each day', fmtMinutes(intake.minutes_per_day)],
        ['Exam date', intake.exam_date ? fmtDate(intake.exam_date) : 'Not set'],
        ['Revision', intake.revision_intensity],
        ['Built from', intake.basis.kind.replace('_', ' ')],
      ].map(([k, v]) => (
        <div key={k}>
          <dt className="text-gray-400">{k}</dt>
          <dd className="font-semibold text-gray-700 dark:text-gray-200 capitalize">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
