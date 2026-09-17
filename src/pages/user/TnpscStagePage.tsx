import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useTnpscCatalog, useTnpscMockTests, useTnpscPracticeTests } from '@/hooks/use-tnpsc';
import {
  LEVEL_GATE_ENABLED,
  LEVEL_META,
  LEVEL_PASS_PERCENTAGE,
  PRACTICE_MAX_QUESTIONS,
  PRACTICE_MIN_QUESTIONS,
  TNPSC_LEVELS,
  answeredCount,
  findStage,
  negativeMarkingLabel,
  questionCountLabel,
  sectionCountLabel,
  sectionSyllabus,
  unitTopics,
  type TnpscLevel,
  type TnpscStage,
  type TnpscTopic,
} from '@/config/tnpsc';
import { testHref, type TnpscLevelGroup, type TnpscPracticeSubject, type TnpscTest } from '@/lib/tnpscApi';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Loader2,
  Lock,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Tab = 'mock' | 'practice';

/**
 * /user/exams/:groupId/:stageId
 * Two tracks for a stage: full-length Mock Tests by level, and syllabus-wise
 * Practice Tests. Level progression is controlled by LEVEL_GATE_ENABLED.
 */
export default function TnpscStagePage() {
  const { groupId, stageId } = useParams<{ groupId: string; stageId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { groups } = useTnpscCatalog();

  const found = findStage(groupId, stageId, groups);
  const tabParam = searchParams.get('tab');
  const tab: Tab = tabParam === 'practice' ? 'practice' : 'mock';
  const setTab = (t: Tab) => setSearchParams(t === 'mock' ? {} : { tab: t }, { replace: true });

  const mock = useTnpscMockTests(groupId, stageId);
  const practice = useTnpscPracticeTests(groupId, stageId);

  const mockCount = useMemo(() => mock.levels.reduce((n, l) => n + l.tests_total, 0), [mock.levels]);
  const practiceCount = useMemo(
    () => practice.subjects.reduce((n, s) => n + s.tests.length, 0),
    [practice.subjects],
  );

  if (!found) return <Navigate to="/user/exams" replace />;
  const { group, stage } = found;
  if (stage.status !== 'active') return <Navigate to={`/user/exams/${group.id}`} replace />;

  return (
    <UserShell>
      <button
        onClick={() => navigate(`/user/exams/${group.id}`)}
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-4 transition-colors animate-fadeIn"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        {group.name}
      </button>

      {/* Stage header */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 mb-5 animate-scaleIn">
        <div className={cn('h-1.5 w-full bg-gradient-to-r', group.accent)} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
                {group.name}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {stage.name}
              </h1>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-2xl">{stage.description}</p>
            </div>
            {stage.pattern && (
              <div className="flex gap-2 text-xs flex-shrink-0">
                <PatternBox value={questionCountLabel(stage.pattern) ?? '—'} label="Questions" />
                <PatternBox value={stage.pattern.total_marks} label="Marks" />
                <PatternBox value={`${stage.pattern.duration_minutes / 60}h`} label="Duration" />
              </div>
            )}
          </div>

          {negativeMarkingLabel(stage.pattern) && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <span className="text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2 py-1 rounded-md">
                {negativeMarkingLabel(stage.pattern)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Syllabus beside the tests, so what's in the paper stays in view while
          picking one — 35 / 65, stacking on anything narrower than lg. */}
      <div className="grid lg:grid-cols-[35fr_65fr] gap-4 sm:gap-5 items-start">
        <SyllabusPanel stage={stage} />

        <div className="min-w-0">
          {/* Track tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-800 mb-5">
            <TabButton
              active={tab === 'mock'}
              onClick={() => setTab('mock')}
              icon={<Trophy className="w-4 h-4" />}
              label="Mock Test"
              count={mock.isLoading ? undefined : mockCount}
            />
            <TabButton
              active={tab === 'practice'}
              onClick={() => setTab('practice')}
              icon={<BookOpen className="w-4 h-4" />}
              label="Practice Test"
              count={practice.isLoading ? undefined : practiceCount}
            />
          </div>

          {tab === 'mock' ? (
            <MockTrack
              levels={mock.levels}
              isLoading={mock.isLoading}
              error={mock.error as Error | null}
              totalQuestions={answeredCount(stage.pattern)}
            />
          ) : (
            <PracticeTrack
              subjects={practice.subjects}
              isLoading={practice.isLoading}
              error={practice.error as Error | null}
            />
          )}
        </div>
      </div>
    </UserShell>
  );
}

// ─── Mock track ────────────────────────────────────────────────────────────────

function MockTrack({
  levels,
  isLoading,
  error,
  totalQuestions,
}: {
  levels: TnpscLevelGroup[];
  isLoading: boolean;
  error: Error | null;
  totalQuestions?: number;
}) {
  if (isLoading) return <LoadingRow label="Loading mock tests…" />;
  if (error) return <ErrorRow message={error.message} />;

  const passPercentage = levels[0]?.required_percentage ?? LEVEL_PASS_PERCENTAGE;

  return (
    <div className="space-y-5">
      {/* Explainer */}
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 p-4 flex items-start gap-3">
        <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Full-length mock tests</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            Every mock follows the real exam pattern
            {totalQuestions ? ` — ${totalQuestions} questions in one sitting` : ''}.{' '}
            {LEVEL_GATE_ENABLED ? (
              <>
                Score <b>{passPercentage}% or more</b> in a <b>Simple</b> mock to unlock <b>Medium</b>,
                and in a <b>Medium</b> mock to unlock <b>Complex</b>.
              </>
            ) : (
              <>
                All three levels are open — start anywhere. A paper counts as{' '}
                <b>cleared</b> once you score {passPercentage}% or more.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Progression rail */}
      <LevelRail levels={levels} />

      {levels.map(level => (
        <LevelSection key={level.level} group={level} />
      ))}
    </div>
  );
}

function LevelRail({ levels }: { levels: TnpscLevelGroup[] }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {TNPSC_LEVELS.map((lv, i) => {
        const g = levels.find(l => l.level === lv);
        const state = !g ? 'locked' : g.is_completed ? 'done' : g.is_unlocked ? 'open' : 'locked';
        return (
          <div key={lv} className="flex items-center gap-2 flex-shrink-0">
            <div
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border',
                state === 'done'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : state === 'open'
                  ? LEVEL_META[lv].chip
                  : 'bg-gray-50 dark:bg-gray-800/60 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700',
              )}
            >
              {state === 'done' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : state === 'locked' ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <span className="w-4 h-4 rounded-full bg-white/70 dark:bg-black/30 text-[10px] flex items-center justify-center">
                  {i + 1}
                </span>
              )}
              {LEVEL_META[lv].label}
            </div>
            {i < TNPSC_LEVELS.length - 1 && (
              <span className="w-6 h-px bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function LevelSection({ group }: { group: TnpscLevelGroup }) {
  const meta = LEVEL_META[group.level];
  const locked = !group.is_unlocked;

  return (
    <section
      className={cn(
        'rounded-2xl border bg-white dark:bg-gray-900 overflow-hidden transition-all',
        locked ? 'border-gray-100 dark:border-gray-800' : meta.ring,
      )}
    >
      <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-100 dark:border-gray-800 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br flex-shrink-0',
              locked ? 'from-gray-300 to-gray-400 dark:from-gray-700 dark:to-gray-600' : meta.accent,
            )}
          >
            {locked ? <Lock className="w-5 h-5" /> : <span className="text-sm font-bold">{meta.order}</span>}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{meta.label} Level</h3>
              {group.is_completed && !locked && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Cleared
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{meta.blurb}</p>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
            {group.tests_completed}/{group.tests_total} cleared
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {group.best_percentage != null ? `Best ${Math.round(group.best_percentage)}%` : 'Not attempted'}
            {LEVEL_GATE_ENABLED && !group.is_completed && ` · pass ${group.required_percentage}%`}
          </p>
        </div>
      </div>

      {locked ? (
        <div className="p-6 text-center">
          <Lock className="w-7 h-7 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Locked</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
            {group.lock_reason ??
              `Clear the previous level with at least ${group.required_percentage}% to unlock.`}
          </p>
        </div>
      ) : group.tests.length === 0 ? (
        <div className="p-6 text-center">
          <FileText className="w-7 h-7 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          {/* An empty level has two very different causes, and telling them apart
              is the difference between "come back later" and "the server is still
              gating this". `lock_reason` survives even when the portal shows the
              level as open, so the real one can be named. */}
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {group.lock_reason
              ? `${group.lock_reason} These papers exist but are not being served yet.`
              : `No ${meta.label.toLowerCase()} mock tests published yet.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
          {group.tests.map((t, i) => (
            <PaperCard
              key={t.test_id}
              test={t}
              index={i}
              ctaLabel={t.attempts_used > 0 && !t.is_completed ? 'Retry Mock' : 'Start Mock'}
              passPercentage={group.required_percentage}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Practice track ────────────────────────────────────────────────────────────

function PracticeTrack({
  subjects,
  isLoading,
  error,
}: {
  subjects: TnpscPracticeSubject[];
  isLoading: boolean;
  error: Error | null;
}) {
  if (isLoading) return <LoadingRow label="Loading practice tests…" />;
  if (error) return <ErrorRow message={error.message} />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 p-4 flex items-start gap-3">
        <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Syllabus-based practice</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
            One short set per subject and topic — {PRACTICE_MIN_QUESTIONS}–{PRACTICE_MAX_QUESTIONS} questions
            each. No level gate: revise any topic, any time.
          </p>
        </div>
      </div>

      {subjects.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400 dark:text-gray-500">
            No practice tests available for this stage yet.
          </p>
        </div>
      ) : (
        subjects.map((s, i) => <SubjectSection key={s.subject_id} subject={s} defaultOpen={i === 0} />)
      )}
    </div>
  );
}

function SubjectSection({ subject, defaultOpen }: { subject: TnpscPracticeSubject; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const count = subject.tests.length;

  return (
    <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">{subject.subject_name}</p>
            {subject.subject_name_ta && (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{subject.subject_name_ta}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={cn(
              'text-[11px] font-bold px-2 py-1 rounded-md',
              count > 0
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
            )}
          >
            {count} set{count !== 1 ? 's' : ''}
          </span>
          <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 p-4">
          {count === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
              Practice sets for this subject are being prepared.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {subject.tests.map((t, i) => (
                <PaperCard key={t.test_id} test={t} index={i} ctaLabel="Start Practice" tone="emerald" />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Shared pieces ─────────────────────────────────────────────────────────────

function PaperCard({
  test,
  index,
  ctaLabel,
  tone = 'indigo',
  passPercentage,
}: {
  test: TnpscTest;
  index: number;
  ctaLabel: string;
  tone?: 'indigo' | 'emerald';
  /** Shown alongside a below-par best score. Omitted for ungated practice sets. */
  passPercentage?: number;
}) {
  const attemptsLeft =
    test.max_attempts == null ? null : Math.max(0, test.max_attempts - test.attempts_used);
  const exhausted = attemptsLeft === 0;
  const blocked = test.is_locked || exhausted;

  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 transition-all animate-slideUp',
        !blocked && 'hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800',
      )}
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-2">{test.title}</p>
          {(test.topic_name || test.subject_name) && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {test.topic_name ?? test.subject_name}
            </p>
          )}
        </div>
        {test.is_completed && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full flex-shrink-0">
            <CheckCircle2 className="w-3 h-3" /> Cleared
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap mt-3">
        <MiniChip icon={<FileText className="w-3 h-3" />} label={`${test.question_count} Qs`} />
        {test.time_limit_minutes ? (
          <MiniChip icon={<Clock className="w-3 h-3" />} label={`${test.time_limit_minutes} min`} />
        ) : null}
        {test.max_marks > 0 && <MiniChip icon={null} label={`${test.max_marks} marks`} />}
        {test.level && (
          <span className={cn('text-[11px] font-semibold px-2 py-1 rounded-md border', LEVEL_META[test.level as TnpscLevel].chip)}>
            {LEVEL_META[test.level as TnpscLevel].label}
          </span>
        )}
        {test.negative_marking && (
          <span className="text-[11px] font-semibold text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded-md">
            -{test.negative_mark_value || 0.25} neg
          </span>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
        <span className="text-[11px] text-gray-500 dark:text-gray-400">
          {test.best_percentage != null ? (
            <>
              Best {Math.round(test.best_percentage)}%
              {LEVEL_GATE_ENABLED && !test.is_completed && passPercentage != null && (
                <span className="text-amber-600 dark:text-amber-400"> · needs {passPercentage}%</span>
              )}
            </>
          ) : test.max_attempts != null ? (
            `${test.attempts_used}/${test.max_attempts} attempts`
          ) : (
            'Not attempted'
          )}
        </span>

        {test.is_locked ? (
          <Link
            to="/user/subscription"
            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40"
          >
            <Lock className="w-3 h-3" /> Upgrade <Sparkles className="w-3 h-3" />
          </Link>
        ) : exhausted ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
            <Lock className="w-3 h-3" /> No attempts left
          </span>
        ) : (
          <Link
            to={testHref(test)}
            className={cn(
              'text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all',
              tone === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700',
            )}
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all duration-300',
        active
          ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
      )}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span
          className={cn(
            'text-xs px-1.5 py-0.5 rounded',
            active
              ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * "What's in the paper" — the sidebar beside the test list.
 *
 * Always open: this is what an aspirant checks while deciding what to sit, so a
 * toggle costs a click every time. Rows expand to their sub-topics one at a time.
 *
 * A section shows its published units and their question counts where the
 * commission publishes them (Group 4). Where it doesn't, the section falls back to
 * listing subjects with their topic counts — no invented question numbers.
 */
function SyllabusPanel({ stage }: { stage: TnpscStage }) {
  const sections = stage.pattern?.sections ?? [];
  const covered = useMemo(
    () =>
      sections
        .map(section => ({ section, subjects: sectionSyllabus(stage, section) }))
        .filter(c => c.section.units?.length || c.subjects.length > 0),
    [stage, sections],
  );
  const unitTotal = covered.reduce((n, c) => n + (c.section.units?.length ?? 0), 0);
  if (covered.length === 0) return null;

  return (
    <aside className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden lg:sticky lg:top-4">
      <div className="flex items-baseline justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          Syllabus
        </p>
        {unitTotal > 0 && (
          <span className="text-[11px] text-gray-400 tabular-nums flex-shrink-0">{unitTotal} units</span>
        )}
      </div>

      <div className="max-h-[calc(100vh-11rem)] overflow-y-auto scrollbar-thin divide-y divide-gray-100 dark:divide-gray-800">
        {covered.map(({ section, subjects }) => (
          <div key={section.name}>
            <div className="flex items-baseline justify-between gap-3 bg-gray-50 dark:bg-gray-800/60 px-4 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                {section.name}
              </p>
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">
                {sectionCountLabel(section)}
              </span>
            </div>

            <ul>
              {section.units?.length
                ? section.units.map(unit => (
                    <SyllabusRow
                      key={unit.id}
                      label={unit.label}
                      name={unit.name}
                      nameTa={unit.name_ta}
                      count={`${unit.questions} Qs`}
                      countStrong
                      topics={unitTopics(stage, unit)}
                    />
                  ))
                : subjects.map(sub => (
                    <SyllabusRow
                      key={sub.id}
                      name={sub.name}
                      nameTa={sub.name_ta}
                      count={`${sub.topics.length} topics`}
                      topics={sub.topics}
                    />
                  ))}
            </ul>

            {section.note && (
              <p className="px-4 py-2 text-[10px] leading-snug text-gray-400 dark:text-gray-500 border-t border-gray-50 dark:border-gray-800/60">
                {section.note}
              </p>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

/** One expandable row — a published unit, or a catalog subject where there is none. */
function SyllabusRow({
  label,
  name,
  nameTa,
  count,
  countStrong,
  topics,
}: {
  label?: string;
  name: string;
  nameTa?: string;
  count: string;
  countStrong?: boolean;
  topics: TnpscTopic[];
}) {
  const [open, setOpen] = useState(false);
  const expandable = topics.length > 0;

  return (
    <li className="border-t border-gray-50 dark:border-gray-800/60 first:border-t-0">
      <button
        type="button"
        onClick={() => expandable && setOpen(v => !v)}
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
        className={cn(
          'w-full flex items-center gap-2 px-4 py-2 text-left transition-colors',
          expandable ? 'hover:bg-gray-50 dark:hover:bg-gray-800/60' : 'cursor-default',
        )}
      >
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 flex-shrink-0 transition-transform',
            open && 'rotate-180',
            expandable ? 'text-gray-400' : 'text-transparent',
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-gray-800 dark:text-gray-200 leading-snug">
            {label && <span className="text-gray-400 dark:text-gray-500">{label} · </span>}
            {name}
          </span>
          {nameTa && (
            <span className="block text-[10px] text-gray-400 dark:text-gray-500 truncate">{nameTa}</span>
          )}
        </span>
        <span
          className={cn(
            'text-[10px] tabular-nums flex-shrink-0',
            countStrong ? 'font-bold text-gray-700 dark:text-gray-200' : 'text-gray-400',
          )}
        >
          {count}
        </span>
      </button>

      {open && expandable && (
        <ul className="pb-2 pl-9 pr-4 flex flex-wrap gap-1">
          {topics.map(t => (
            <li
              key={t.id}
              className="text-[10px] bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded"
            >
              {t.name}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function PatternBox({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-1.5 text-center">
      <p className="font-bold text-base text-gray-900 dark:text-gray-100 leading-tight">{value}</p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

function MiniChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md">
      {icon}
      {label}
    </span>
  );
}

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-20 gap-3 text-gray-400 dark:text-gray-500">
      <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-8 text-center">
      <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
      <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Could not load this section</p>
      <p className="text-xs text-red-500">{message}</p>
    </div>
  );
}
