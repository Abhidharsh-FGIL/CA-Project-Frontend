import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useTnpscCatalog, useTnpscMockTests, useTnpscPracticeTests } from '@/hooks/use-tnpsc';
import {
  LEVELS_HIDDEN,
  LEVEL_GATE_ENABLED,
  LEVEL_META,
  LEVEL_PASS_PERCENTAGE,
  SINGLE_LEVEL_BLURB,
  SINGLE_LEVEL_HEADING,
  TNPSC_LEVELS,
  VISIBLE_LEVELS,
  findStage,
  negativeMarkingLabel,
  answeredCount,
  questionCountLabel,
  sectionCountLabel,
  sectionSyllabus,
  unitTopics,
  type TnpscLevel,
  type TnpscPatternSection,
  type TnpscStage,
  type TnpscSyllabusUnit,
  type TnpscTopic,
} from '@/config/tnpsc';
import { testHref, type TnpscLevelGroup, type TnpscTest } from '@/lib/tnpscApi';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  FlaskConical,
  Globe2,
  Landmark,
  Languages,
  Layers,
  ListChecks,
  Loader2,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * /user/exams/:groupId/:stageId
 *
 * Two tracks for a stage, both organised by the *published syllabus unit* rather
 * than by whatever the test catalog happens to be grouped by: Practice (untimed
 * sets, card grid) and Exam (full-length papers by level, list rows).
 *
 * The unit is the organising idea on this screen. It is what the commission
 * publishes question counts against, it is what the syllabus panel on the left
 * lists, and it is therefore the thing an aspirant is actually choosing between —
 * so the unit's numeral, name and question count lead every row, and the papers
 * sit underneath it.
 */

type Tab = 'practice' | 'exam';

/** The buttons a unit offers. `all` is every paper it holds, in one sitting. */
type LevelKey = TnpscLevel | 'all';

// ─── Unit presentation ────────────────────────────────────────────────────────

/**
 * Six accents, cycled by unit order.
 *
 * Deliberately positional rather than keyed by subject id: a stage can carry any
 * units, and a palette keyed by name would leave a new exam's units uncoloured.
 */
const UNIT_ACCENT = [
  { dot: 'bg-blue-500', badge: 'bg-blue-500', soft: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400', ring: 'border-blue-200 dark:border-blue-900' },
  { dot: 'bg-emerald-500', badge: 'bg-emerald-500', soft: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', ring: 'border-emerald-200 dark:border-emerald-900' },
  { dot: 'bg-amber-500', badge: 'bg-amber-500', soft: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', ring: 'border-amber-200 dark:border-amber-900' },
  { dot: 'bg-violet-500', badge: 'bg-violet-500', soft: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-600 dark:text-violet-400', ring: 'border-violet-200 dark:border-violet-900' },
  { dot: 'bg-rose-500', badge: 'bg-rose-500', soft: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-600 dark:text-rose-400', ring: 'border-rose-200 dark:border-rose-900' },
  { dot: 'bg-cyan-500', badge: 'bg-cyan-500', soft: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-600 dark:text-cyan-400', ring: 'border-cyan-200 dark:border-cyan-900' },
] as const;

const accentFor = (i: number) => UNIT_ACCENT[i % UNIT_ACCENT.length];

/**
 * An icon per unit, matched on the words the syllabus actually uses.
 *
 * Falls back to a book, so a unit this list has never seen still renders.
 */
function unitIcon(name: string) {
  const n = name.toLowerCase();
  if (/science|physic|chem|biolog/.test(n)) return FlaskConical;
  if (/geograph/.test(n)) return Globe2;
  if (/histor|culture|movement/.test(n)) return Landmark;
  if (/polit|constitut|governance/.test(n)) return Scale;
  if (/econom|development/.test(n)) return TrendingUp;
  if (/tamil|english|language/.test(n)) return Languages;
  if (/aptitude|mental|math/.test(n)) return Target;
  return BookOpen;
}

// ─── Unit model ───────────────────────────────────────────────────────────────

interface UnitRowModel {
  key: string;
  label?: string;
  name: string;
  nameTa?: string;
  questions: number | null;
  topics: TnpscTopic[];
  /** Papers that belong to this unit, from whichever track is on screen. */
  tests: TnpscTest[];
}

/** Letters only, lowercased — ids, Tamil labels and titles all normalise to this. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/**
 * Whether two labels name the same thing.
 *
 * Exact after normalising, or one contained in the other once both are long
 * enough for containment to mean something — "Reading Comprehension" is the unit
 * the topic `comprehension` belongs to, but a 3-letter overlap would match
 * anything. Five is the shortest length where a false positive stops being likely.
 */
function sameLabel(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const short = x.length <= y.length ? x : y;
  const long = short === x ? y : x;
  return short.length >= 5 && long.includes(short);
}

/**
 * Which papers belong to a unit.
 *
 * Three stages, in order of how much the data actually tells us:
 *
 *  1. the unit's own `subject_ids` — how the General Studies units are linked;
 *  2. its topic ids — how the Aptitude units are linked;
 *  3. its *name*, against the paper's topic or subject.
 *
 * Stage 3 exists because a published unit need not carry either link: every
 * General Tamil unit in the catalog is a bare `{id, label, name, questions}`, so
 * stages 1 and 2 have nothing to compare and the whole section would read as
 * "being prepared" while its papers sat in the catalog. It runs only when the
 * first two found nothing, so a properly-linked unit is never widened by it.
 *
 * A paper matching none of the three is not forced into a unit — it surfaces
 * under "Other papers", because filing it under the wrong unit would misreport
 * what the aspirant has covered.
 */
function testsForUnit(unit: TnpscSyllabusUnit, topics: TnpscTopic[], tests: TnpscTest[]): TnpscTest[] {
  const subjectIds = new Set(unit.subject_ids ?? []);
  const topicIds = new Set(topics.map(t => t.id));

  const linked = tests.filter(t => {
    if (t.subject_id && subjectIds.has(t.subject_id)) return true;
    if (t.topic_id && topicIds.has(t.topic_id)) return true;
    return false;
  });
  if (linked.length > 0) return linked;

  return tests.filter(t => {
    if (t.topic_id && sameLabel(unit.name, t.topic_id)) return true;
    if (t.topic_name && sameLabel(unit.name, t.topic_name)) return true;
    if (unit.name_ta && t.topic_name && sameLabel(unit.name_ta, t.topic_name)) return true;
    // Subject-level only when the unit has no linkage of its own — otherwise an
    // unlinked unit would swallow every paper in its section.
    if (!unit.subject_ids?.length && !topics.length) {
      if (t.subject_name && sameLabel(unit.name, t.subject_name)) return true;
      if (t.subject_id && sameLabel(unit.name, t.subject_id)) return true;
    }
    return false;
  });
}

/** What a difficulty button needs to know about itself. */
interface LevelStat {
  key: LevelKey;
  papers: TnpscTest[];
  /** The paper the button opens — the only one, or the first of several. */
  test: TnpscTest | null;
  attempts: number;
  /** True when every paper at this difficulty has been passed. */
  cleared: boolean;
  best: number | null;
}

/**
 * Every difficulty a unit offers, whether or not a paper exists behind it.
 *
 * All four are always returned. Showing only the populated ones made the row
 * jump about between units and hid the fact that a difficulty exists at all —
 * and on the Practice track it collapsed to a single button, because practice
 * papers are ungated and carry no level (`TnpscTest.level` is null for them).
 * An empty difficulty renders disabled and says so, which is information;
 * omitting it is not.
 */
function levelStats(tests: TnpscTest[]): LevelStat[] {
  const stat = (key: LevelKey, papers: TnpscTest[]): LevelStat => ({
    key,
    papers,
    test: papers[0] ?? null,
    attempts: papers.reduce((n, t) => n + (t.attempts_used ?? 0), 0),
    cleared: papers.length > 0 && papers.every(t => t.is_completed),
    best: papers.reduce<number | null>(
      (b, t) => (t.best_percentage == null ? b : b == null ? t.best_percentage : Math.max(b, t.best_percentage)),
      null,
    ),
  });

  const graded = (['simple', 'medium', 'complex'] as TnpscLevel[]).map(lv =>
    stat(lv, tests.filter(t => t.level === lv)),
  );

  // The fourth button is the whole unit in one sitting — every paper it holds,
  // including the ungated practice sets that carry no difficulty of their own.
  return [...graded, stat('all', tests)];
}

const LEVEL_LABEL: Record<LevelKey, string> = {
  simple: 'Simple',
  medium: 'Medium',
  complex: 'Complex',
  all: 'Full Unit',
};

/** A paper section — the level this screen is organised at. */
interface SectionModel {
  key: string;
  name: string;
  /** The section this one is sat instead of, where the paper offers a choice. */
  alternativeTo?: string;
  questions: number;
  countLabel: string;
  note?: string;
  units: UnitRowModel[];
  /** Every paper under the section, however it was matched. */
  tests: TnpscTest[];
  /** The one paper that covers the whole section, when the catalog has one. */
  fullSet: TnpscTest | null;
  /** Subject names, for the one-line summary under the title. */
  blurb: string;
  /**
   * True for the Tamil-language paper, where the Tamil title is *the* title.
   *
   * Its units are printed in Tamil and sat in Tamil, so pairing each with an
   * English gloss is noise — the candidate reading this section does not need
   * "Grammar" next to "இலக்கணம்". Everywhere else the English title leads and the
   * Tamil sits beside it.
   */
  tamilOnly: boolean;
}

/**
 * The complete paper for a section.
 *
 * A "full set" carries no topic and matches the section's published question
 * count. Matching on the count rather than on the title keeps it honest — a
 * section with no such paper gets no button, rather than one that leads nowhere.
 */
function fullSetFor(section: TnpscPatternSection, tests: TnpscTest[]): TnpscTest | null {
  return (
    tests.find(t => !t.topic_id && t.question_count === section.questions) ??
    tests.find(t => !t.topic_id && t.subject_name && sameLabel(section.name, t.subject_name)) ??
    null
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TnpscStagePage() {
  const { groupId, stageId } = useParams<{ groupId: string; stageId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { groups } = useTnpscCatalog();

  const found = findStage(groupId, stageId, groups);
  // Practice leads now: it is the everyday screen, and a full paper is the
  // occasional event rather than the default thing to open.
  const tabParam = searchParams.get('tab');
  const tab: Tab = tabParam === 'exam' || tabParam === 'mock' ? 'exam' : 'practice';
  const setTab = (t: Tab) => {
    setSearchParams(t === 'practice' ? {} : { tab: t }, { replace: true });
    // The drill belongs to the Practice track; carrying it into Exam would leave
    // the syllabus panel describing a section the pane is no longer showing.
    setDrillKey(null);
  };

  /**
   * The section being worked through, if any.
   *
   * Unit-wise practice is a drill-down rather than an expanding row: a section's
   * units each carry four difficulty buttons, and three sections' worth of that
   * on one screen buries the one the aspirant actually opened.
   */
  const [drillKey, setDrillKey] = useState<string | null>(null);
  /**
   * The syllabus panel folds away to a rail.
   *
   * Open it costs a third of the width, which is the right trade while you are
   * deciding what to sit and the wrong one once you have decided — the unit rows
   * carry four difficulty buttons each and want the room.
   */
  const [syllabusOpen, setSyllabusOpen] = useState(true);
  const [unitFilter, setUnitFilter] = useState<string | null>(null);

  const mock = useTnpscMockTests(groupId, stageId);
  const practice = useTnpscPracticeTests(groupId, stageId);

  const stage = found?.stage;
  const group = found?.group;

  /** Every paper in the active track, flattened — units pick from this. */
  const trackTests = useMemo<TnpscTest[]>(
    () =>
      tab === 'practice'
        ? practice.subjects.flatMap(s => s.tests)
        : mock.levels.flatMap(l => l.tests),
    [tab, practice.subjects, mock.levels],
  );

  const sections = useMemo<SectionModel[]>(() => {
    if (!stage) return [];

    return (stage.pattern?.sections ?? []).map(section => {
      const units: UnitRowModel[] = section.units?.length
        ? section.units.map(unit => {
            const topics = unitTopics(stage, unit);
            /**
             * Display and matching want different topic lists.
             *
             * `unitTopics` returns the unit's own topics when it has them — the
             * commission's printed text, which is what belongs on screen. Papers
             * are tagged against the catalog's taxonomy instead (`physics`,
             * `sangam-age`), so matching gets both lists; otherwise giving a unit
             * its published topics would quietly stop matching its papers.
             */
            const matchTopics = [
              ...topics,
              ...(stage.subjects ?? [])
                .filter(sub => unit.subject_ids?.includes(sub.id))
                .flatMap(sub => sub.topics),
            ];
            return {
              key: unit.id,
              label: unit.label,
              name: unit.name,
              nameTa: unit.name_ta,
              questions: unit.questions,
              topics,
              tests: testsForUnit(unit, matchTopics, trackTests),
            };
          })
        : // No published units — fall back to the section's catalog subjects, with
          // topic counts rather than invented question numbers.
          sectionSyllabus(stage, section).map(sub => ({
            key: sub.id,
            name: sub.name,
            nameTa: sub.name_ta,
            questions: null,
            topics: sub.topics,
            tests: trackTests.filter(t => t.subject_id === sub.id),
          }));

      const subjects = sectionSyllabus(stage, section);
      const names = (subjects.length ? subjects.map(x => x.name) : units.map(u => u.name)).filter(Boolean);
      const blurb =
        names.length > 3 ? `${names.slice(0, 3).join(', ')} and more…` : names.join(', ');

      const inUnits = units.flatMap(u => u.tests);
      const full = fullSetFor(section, trackTests);
      const seen = new Set(inUnits.map(t => t.test_id));
      const tests = full && !seen.has(full.test_id) ? [...inUnits, full] : inUnits;

      // The language paper is sat in one language or the other; a section that
      // still carries both subjects (an un-split server payload) is not Tamil-only.
      const subjectIds = section.syllabus_subject_ids ?? section.subject_ids ?? [];
      const tamilOnly =
        subjectIds.includes('general-tamil') && !subjectIds.includes('general-english');

      return {
        key: section.name,
        name: section.name,
        alternativeTo: section.alternative_to,
        questions: section.questions,
        countLabel: sectionCountLabel(section),
        note: section.note,
        units,
        tests,
        fullSet: full,
        blurb,
        tamilOnly,
      };
    });
  }, [stage, trackTests]);

  if (!groupId || !stageId) return <Navigate to="/user/exams" replace />;
  if (!found || !stage || !group) {
    return (
      <UserShell>
        <div className="text-center py-20">
          <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">This exam stage could not be found.</p>
          <button
            onClick={() => navigate('/user/exams')}
            className="mt-4 text-sm font-semibold text-indigo-600 hover:underline"
          >
            Back to exams
          </button>
        </div>
      </UserShell>
    );
  }

  const isLoading = tab === 'practice' ? practice.isLoading : mock.isLoading;
  const error = (tab === 'practice' ? practice.error : mock.error) as Error | null;
  const drill = drillKey ? (sections.find(x => x.key === drillKey) ?? null) : null;
  const verb = tab === 'practice' ? 'Practice' : 'Exam';

  const openDrill = (key: string) => {
    setDrillKey(key);
    setUnitFilter(null);
  };

  return (
    <UserShell>
      <Link
        to={`/user/exams/${groupId}`}
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to {group.name}
      </Link>

      <StageHero stage={stage} groupName={group.name} accent={group.accent} />

      {/* Syllabus beside the papers, so what's in the exam stays in view while
          picking one — a third of the width open, a rail when folded. */}
      <div
        className={cn(
          'grid gap-4 sm:gap-5 items-start transition-[grid-template-columns] duration-200',
          syllabusOpen ? 'lg:grid-cols-[minmax(0,34fr)_minmax(0,66fr)]' : 'lg:grid-cols-[3rem_minmax(0,1fr)]',
        )}
      >
        <SyllabusPanel
          sections={sections}
          drill={drill}
          collapsed={!syllabusOpen}
          onCollapsedChange={v => setSyllabusOpen(!v)}
          onOpen={k => (k ? openDrill(k) : setDrillKey(null))}
        />

        <div className="min-w-0 space-y-4">
          <TrackTabs tab={tab} onChange={setTab} />

          {isLoading ? (
            <LoadingRow label={tab === 'practice' ? 'Loading practice tests…' : 'Loading exam papers…'} />
          ) : error ? (
            <ErrorRow message={error.message} />
          ) : tab === 'exam' ? (
            // Ahead of the sections guard: a mock belongs to no section, so a
            // stage whose syllabus has not been published still has mocks to sit.
            <ExamTrack levels={mock.levels} totalQuestions={answeredCount(stage.pattern)} />
          ) : sections.length === 0 ? (
            <EmptyRow label="No sections are published for this stage yet." />
          ) : drill ? (
            <>
              <DrillHeader section={drill} verb={verb} onBack={() => setDrillKey(null)} />

              {drill.units.length > 1 && (
                <UnitFilterPills units={drill.units} value={unitFilter} onChange={setUnitFilter} />
              )}

              <div className="space-y-2.5">
                {(unitFilter ? drill.units.filter(u => u.key === unitFilter) : drill.units).map(
                  (u, i) => (
                    <UnitListRow
                      key={u.key}
                      unit={u}
                      index={drill.units.indexOf(u)}
                      order={i}
                      verb={verb}
                      passPercentage={mock.levels[0]?.required_percentage ?? LEVEL_PASS_PERCENTAGE}
                      tamilOnly={drill.tamilOnly}
                    />
                  ),
                )}
              </div>

              {drill.fullSet && <FullSetBar section={drill} verb={verb} />}
            </>
          ) : (
            <>
              <TrackBanner tab={tab} />

              {sections.map((sec, i) => (
                <SectionRow
                  key={sec.key}
                  section={sec}
                  index={i}
                  verb={verb}
                  onDrill={() => openDrill(sec.key)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </UserShell>
  );
}

// ─── Exam track ───────────────────────────────────────────────────────────────

/**
 * Full-length mock papers, grouped by difficulty.
 *
 * Deliberately *not* organised by syllabus unit like the Practice track is. A
 * mock follows the real exam pattern — every unit in one sitting — so it belongs
 * to no single unit, and the unit matcher could never place one. Rendering the
 * levels the API already groups them into is both simpler and the only honest
 * shape for this data.
 */
function ExamTrack({
  levels,
  totalQuestions,
}: {
  levels: TnpscLevelGroup[];
  totalQuestions?: number;
}) {
  const passPercentage = levels[0]?.required_percentage ?? LEVEL_PASS_PERCENTAGE;

  /**
   * Which level groups to show.
   *
   * `VISIBLE_LEVELS` is the product's choice of what to offer, but a level that
   * actually holds papers is shown whatever that says — a mock someone has
   * published and an aspirant cannot see is worse than an extra heading.
   */
  const groups = levels.filter(g => VISIBLE_LEVELS.includes(g.level) || g.tests.length > 0);
  const total = groups.reduce((n, g) => n + g.tests.length, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/80 to-violet-50/60 dark:from-indigo-950/30 dark:to-violet-950/20 p-4 flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center flex-shrink-0">
          <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Full-length mock tests</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
            Every mock follows the real exam pattern
            {totalQuestions ? ` — ${totalQuestions} questions in one sitting` : ''}.{' '}
            {LEVEL_GATE_ENABLED ? (
              <>
                Score <b>{passPercentage}% or more</b> in a Simple mock to unlock Medium, and in a
                Medium mock to unlock Complex.
              </>
            ) : (
              <>
                A paper counts as <b>cleared</b> once you score {passPercentage}% or more.
              </>
            )}
          </p>
        </div>
      </div>

      {!LEVELS_HIDDEN && groups.length > 1 && <LevelRail levels={levels} />}

      {groups.length === 0 || total === 0 ? (
        <EmptyRow label="No mock tests have been published for this stage yet." />
      ) : (
        groups.map(g => <LevelSection key={g.level} group={g} />)
      )}
    </div>
  );
}

/** Simple → Medium → Complex, with where the aspirant has got to. */
function LevelRail({ levels }: { levels: TnpscLevelGroup[] }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
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

/** One difficulty's papers, with its gate and its progress. */
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
            {locked ? (
              <Lock className="w-5 h-5" />
            ) : LEVELS_HIDDEN ? (
              <FileText className="w-5 h-5" />
            ) : (
              <span className="text-sm font-bold">{meta.order}</span>
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                {LEVELS_HIDDEN ? SINGLE_LEVEL_HEADING : `${meta.label} Level`}
              </h3>
              {group.is_completed && !locked && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Cleared
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {LEVELS_HIDDEN ? SINGLE_LEVEL_BLURB : meta.blurb}
            </p>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
            {group.tests_completed}/{group.tests_total} cleared
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {group.best_percentage != null
              ? `Best ${Math.round(group.best_percentage)}%`
              : 'Not attempted'}
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
              : LEVELS_HIDDEN
                ? 'No mock tests published yet.'
                : `No ${meta.label.toLowerCase()} mock tests published yet.`}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2.5 p-3.5">
          {group.tests.map((t, i) => (
            <PaperRow key={t.test_id} test={t} index={i} passPercentage={group.required_percentage} />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Drill-down header ────────────────────────────────────────────────────────

function DrillHeader({
  section,
  verb,
  onBack,
}: {
  section: SectionModel;
  verb: string;
  onBack: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/80 to-violet-50/60 dark:from-indigo-950/30 dark:to-violet-950/20 p-4">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center flex-shrink-0">
          <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {section.name} — unit-wise {verb.toLowerCase()}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
            Pick a unit, then a difficulty. Each button opens that paper straight away.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900"
        >
          <ArrowLeft className="w-3 h-3" /> All sections
        </button>
      </div>
    </div>
  );
}

// ─── Unit filter ──────────────────────────────────────────────────────────────

function UnitFilterPills({
  units,
  value,
  onChange,
}: {
  units: UnitRowModel[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'flex-shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-colors',
          value == null
            ? 'bg-indigo-600 text-white'
            : 'border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-indigo-300',
        )}
      >
        All Units
      </button>

      {units.map((u, i) => {
        const active = value === u.key;
        return (
          <button
            key={u.key}
            type="button"
            onClick={() => onChange(active ? null : u.key)}
            title={u.nameTa ? `${u.name} · ${u.nameTa}` : u.name}
            className={cn(
              'flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-colors border',
              active
                ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-indigo-300',
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', accentFor(i).dot)} />
            {shortUnitName(u.nameTa ?? u.name)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A short pill label — "History, Culture of India…" does not fit a filter chip.
 *
 * Splits on the dash as well as the comma, because the Tamil titles separate
 * their clauses that way: "வாசித்தல் – புரிந்து கொள்ளும் திறன்" wants to become
 * "வாசித்தல்", not the first two words of it.
 */
function shortUnitName(name: string): string {
  const head = name.split(/[,&(–—]/)[0].trim();
  const words = head.split(/\s+/);
  return words.length <= 3 ? head : words.slice(0, 2).join(' ');
}

// ─── Section row ──────────────────────────────────────────────────────────────

/**
 * One section: what it contains, and the two ways into it.
 *
 * The action pair sits in a fixed-width column rather than flowing after the
 * title, so the buttons line up down the page however long a section's name or
 * blurb runs. Without that the eye has to re-find them on every row.
 */
function SectionRow({
  section,
  index,
  verb,
  onDrill,
}: {
  section: SectionModel;
  index: number;
  verb: string;
  onDrill: () => void;
}) {
  const a = accentFor(index);

  return (
    <section className={cn('rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden', a.soft)}>
      <div className="p-4 flex items-start gap-3 flex-wrap sm:flex-nowrap">
        <SectionGlyph name={section.name} badge={a.badge} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">
              {section.name}
            </h3>
            {section.alternativeTo && (
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded-full">
                or {section.alternativeTo}
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mt-0.5">
            {section.units.length} Unit{section.units.length === 1 ? '' : 's'}
            <span className="mx-1.5 text-gray-300 dark:text-gray-600">•</span>
            {section.countLabel}
          </p>
          {section.blurb && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
              {section.blurb}
            </p>
          )}
          {section.note && (
            <p className="mt-1.5 text-[10px] leading-snug text-gray-400 dark:text-gray-500">
              {section.note}
            </p>
          )}
        </div>

        {/* Fixed widths, so the two tiles are in the same place on every row. */}
        <div className="flex items-stretch gap-2 flex-shrink-0 w-full sm:w-auto">
          <ActionTile
            icon={<ListChecks className="w-4 h-4" />}
            title={`Unit-wise ${verb}`}
            sub={`${section.units.length} Unit${section.units.length === 1 ? '' : 's'}`}
            accent={a}
            onClick={onDrill}
            disabled={section.units.length === 0}
          />
          <ActionTile
            icon={<Layers className="w-4 h-4" />}
            title={`Full Set ${verb}`}
            sub={section.fullSet ? `${section.fullSet.question_count} Questions` : 'Not available'}
            accent={a}
            to={
              section.fullSet
                ? section.fullSet.is_locked
                  ? '/user/subscription'
                  : testHref(section.fullSet)
                : undefined
            }
            disabled={!section.fullSet}
          />
        </div>
      </div>
    </section>
  );
}

/** A section's mark — the Tamil letter for the Tamil paper, otherwise an icon. */
function SectionGlyph({ name, badge }: { name: string; badge: string }) {
  const Icon = unitIcon(name);
  // "Tamil Nadu History" is a General Studies unit, not the language paper.
  const tamilPaper = /tamil/i.test(name) && !/nadu|history/i.test(name);

  return (
    <span
      className={cn(
        'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-white shadow-sm',
        badge,
      )}
      aria-hidden
    >
      {tamilPaper ? <span className="text-xl font-bold leading-none">அ</span> : <Icon className="w-6 h-6" />}
    </span>
  );
}

/**
 * One of a section's two ways in.
 *
 * Renders as a link when it launches a paper and as a button when it expands the
 * unit list — same shape either way, because to the aspirant they are the same
 * kind of choice. Disabled when there is nothing behind it, rather than hidden,
 * so the pair stays in the same place on every row.
 */
function ActionTile({
  icon,
  title,
  sub,
  accent,
  active,
  disabled,
  to,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  accent: (typeof UNIT_ACCENT)[number];
  active?: boolean;
  disabled?: boolean;
  /** Set when the tile launches a paper. */
  to?: string;
  onClick?: () => void;
}) {
  const shell = cn(
    'flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all',
    // A fixed basis keeps the pair the same size on every section row.
    'flex-1 sm:flex-none sm:w-[9.5rem]',
    disabled
      ? 'border-transparent bg-white/50 dark:bg-gray-900/30 opacity-50 cursor-not-allowed'
      : active
        ? cn(accent.ring, 'bg-white dark:bg-gray-900 shadow-sm')
        : 'border-transparent bg-white/70 dark:bg-gray-900/40 hover:bg-white dark:hover:bg-gray-900 hover:shadow-sm',
  );

  const body = (
    <>
      <span
        className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
          disabled
            ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
            : cn(accent.soft, accent.text),
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold text-gray-800 dark:text-gray-100 leading-tight">
          {title}
        </span>
        <span className="block text-[10px] text-gray-500 dark:text-gray-400">{sub}</span>
      </span>
      {!disabled && (
        <ChevronRight
          className={cn(
            'w-3.5 h-3.5 flex-shrink-0 text-gray-300 dark:text-gray-600 transition-transform',
            active && 'rotate-90',
          )}
        />
      )}
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={shell}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-expanded={active} className={shell}>
      {body}
    </button>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function StageHero({
  stage,
  groupName,
  accent,
}: {
  stage: TnpscStage;
  groupName: string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm mb-4 sm:mb-5">
      <div className={cn('h-1.5 w-full bg-gradient-to-r', accent)} />

      {/* A wash behind the title, so the band reads as a cover rather than a bar. */}
      <div className="absolute inset-x-0 top-1.5 h-32 bg-gradient-to-br from-indigo-50/80 via-white to-white dark:from-indigo-950/30 dark:via-gray-900 dark:to-gray-900 pointer-events-none" />

      <div className="relative p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">
              {groupName}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {stage.name}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1.5 max-w-2xl leading-relaxed">
              {stage.description}
            </p>
          </div>

          {stage.pattern && (
            <div className="flex gap-2.5 flex-shrink-0 flex-wrap">
              <StatCard
                icon={<FileText className="w-4 h-4" />}
                tone="indigo"
                value={questionCountLabel(stage.pattern) ?? '—'}
                label="Questions"
              />
              <StatCard
                icon={<Layers className="w-4 h-4" />}
                tone="emerald"
                value={stage.pattern.total_marks}
                label="Marks"
              />
              <StatCard
                icon={<Clock className="w-4 h-4" />}
                tone="amber"
                value={`${stage.pattern.duration_minutes / 60}h`}
                label="Duration"
              />
            </div>
          )}
        </div>

        {negativeMarkingLabel(stage.pattern) && (
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <span className="text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2 py-1 rounded-md">
              {negativeMarkingLabel(stage.pattern)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

const STAT_TONE = {
  indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
} as const;

function StatCard({
  icon,
  tone,
  value,
  label,
}: {
  icon: React.ReactNode;
  tone: keyof typeof STAT_TONE;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2 shadow-sm">
      <span className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', STAT_TONE[tone])}>
        {icon}
      </span>
      <div>
        <p className="text-lg font-bold leading-none text-gray-900 dark:text-gray-100">{value}</p>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Tabs and banner ──────────────────────────────────────────────────────────

function TrackTabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const items: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [
    { key: 'practice', label: 'Practice', icon: <Pencil className="w-4 h-4" /> },
    { key: 'exam', label: 'Exam', icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <div
      role="tablist"
      aria-label="Track"
      className="inline-flex gap-1 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/40 p-1"
    >
      {items.map(it => {
        const active = tab === it.key;
        return (
          <button
            key={it.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.key)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition-all',
              active
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
            )}
          >
            {it.icon}
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function TrackBanner({ tab }: { tab: Tab }) {
  const practice = tab === 'practice';
  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/80 to-violet-50/60 dark:from-indigo-950/30 dark:to-violet-950/20 p-4">
      <div className="relative flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center flex-shrink-0">
          <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {practice ? 'Choose Your Practice' : 'Choose Your Exam'}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
            Select a subject to start unit-wise {practice ? 'practice' : 'papers'}, or try the full set for
            a complete {practice ? 'revision' : 'sitting'}.
          </p>
        </div>
      </div>

      {/* Decorative only — hidden from assistive tech and from narrow screens. */}
      <Sparkles
        aria-hidden
        className="hidden sm:block absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 text-indigo-200 dark:text-indigo-900"
      />
    </div>
  );
}

// ─── Unit row (drill-down) ────────────────────────────────────────────────────

/**
 * One unit, with a launch button per difficulty.
 *
 * The difficulty buttons are the whole interaction — each opens its paper
 * directly. The chevron is only for seeing what is behind a difficulty that
 * holds more than one paper, so it is offered rather than required.
 */
function UnitListRow({
  unit,
  index,
  order,
  verb,
  passPercentage,
  tamilOnly,
}: {
  unit: UnitRowModel;
  index: number;
  order: number;
  verb: string;
  passPercentage: number;
  /** The Tamil paper: its units need no English gloss. */
  tamilOnly: boolean;
}) {
  const a = accentFor(index);
  const levels = levelStats(unit.tests);
  const anyPaper = unit.tests.length > 0;

  return (
    <section
      className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden animate-slideUp"
      style={{ animationDelay: `${order * 0.04}s` }}
    >
      <div className="flex items-center gap-3 p-3.5 flex-wrap">
        <span
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold',
            a.badge,
          )}
        >
          {unit.label ?? index + 1}
        </span>

        <div className="min-w-0 flex-1">
          {/* Under the Tamil paper the Tamil title stands alone. Elsewhere the
              English title leads and the Tamil follows on its own line — inline,
              the two scripts ran together once a title wrapped, and the longer
              General Studies units wrap on every screen width. */}
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">
            {tamilOnly && unit.nameTa ? unit.nameTa : unit.name}
          </p>
          {!tamilOnly && unit.nameTa && (
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-snug mt-0.5">
              {unit.nameTa}
            </p>
          )}
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            {unit.questions != null ? `${unit.questions} Questions` : `${unit.topics.length} topics`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {levels.map(l => (
            <LevelButton key={l.key} stat={l} />
          ))}
        </div>

        {!anyPaper && (
          <p className="w-full text-[10px] text-gray-400 pl-12">
            {verb} papers for this unit are being prepared.
          </p>
        )}
      </div>

    </section>
  );
}

/**
 * A difficulty, as a button that opens its paper.
 *
 * Carries its own history: how many times it has been attempted, and whether it
 * has been cleared. That is the question an aspirant actually has when looking at
 * a unit — not "does a Medium paper exist" but "have I done it, and did I pass" —
 * and answering it here saves opening each paper to find out.
 *
 * Disabled when the catalog holds no paper at this difficulty, rather than
 * hidden, so every unit presents the same four choices in the same places.
 */
function LevelButton({ stat }: { stat: LevelStat }) {
  const { key, test, attempts, cleared, best } = stat;
  const meta = key === 'all' ? null : LEVEL_META[key];
  const locked = test?.is_locked ?? false;

  const className = cn(
    'flex flex-col items-start justify-center gap-0.5 rounded-lg border px-2.5 py-1.5 text-left transition-all w-[5.75rem] flex-shrink-0',
    meta
      ? meta.chip
      : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
    test ? 'hover:brightness-95 hover:shadow-sm' : 'opacity-45 cursor-not-allowed',
    cleared && 'ring-1 ring-emerald-400 dark:ring-emerald-600',
  );

  /** One line of history, or why the button cannot be pressed. */
  const detail = !test
    ? 'No paper yet'
    : cleared
      ? best != null
        ? `Cleared · ${Math.round(best)}%`
        : 'Cleared'
      : attempts > 0
        ? `${attempts} attempt${attempts === 1 ? '' : 's'}`
        : 'Not attempted';

  const body = (
    <>
      <span className="flex items-center gap-1 w-full min-w-0">
        {key === 'all' && <Layers className="w-3 h-3 flex-shrink-0" />}
        <span className="text-[10px] font-bold truncate">{LEVEL_LABEL[key]}</span>
        {cleared && <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-emerald-500 ml-auto" />}
        {locked && !cleared && <Lock className="w-2.5 h-2.5 flex-shrink-0 ml-auto" />}
      </span>
      <span className="text-[9px] leading-none opacity-70 truncate w-full">{detail}</span>
    </>
  );

  if (!test) {
    return (
      <span className={className} aria-disabled>
        {body}
      </span>
    );
  }

  // A locked paper routes to the paywall rather than into a test it cannot open.
  return (
    <Link
      to={locked ? '/user/subscription' : testHref(test)}
      title={locked ? (test.lock_reason ?? 'Upgrade to unlock') : test.title}
      className={className}
    >
      {body}
    </Link>
  );
}

// ─── Full set ─────────────────────────────────────────────────────────────────

/** The one paper that covers a whole section, offered at the foot of its units. */
function FullSetBar({ section, verb }: { section: SectionModel; verb: string }) {
  const test = section.fullSet;
  if (!test) return null;

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex items-center gap-3 flex-wrap">
      <span className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0">
        <Layers className="w-5 h-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Full Set {verb}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
          Take the complete set of questions from all units in one sitting.
        </p>
      </div>

      <Link
        to={test.is_locked ? '/user/subscription' : testHref(test)}
        className="inline-flex items-center gap-2.5 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-white transition-all hover:bg-indigo-700 hover:shadow-md flex-shrink-0"
      >
        <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          {test.is_locked ? <Lock className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
        </span>
        <span className="text-left">
          <span className="block text-xs font-bold leading-tight">{section.name}</span>
          <span className="block text-[10px] opacity-80">{test.question_count} Questions</span>
        </span>
        <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-80" />
      </Link>
    </div>
  );
}

// ─── Shared pieces ─────────────────────────────────────────────────────────────

/**
 * One paper, as a single clickable row.
 *
 * There is no "Start Practice" button on it. The row names one paper and does
 * one thing, so the button would have been a second target for the same action
 * sitting inside the first — and it pushed the useful detail (questions, time,
 * best score) into a cramped column beside it.
 */
function PaperRow({
  test,
  index,
  passPercentage,
}: {
  test: TnpscTest;
  index: number;
  /** Shown alongside a below-par best score. Omitted for ungated practice sets. */
  passPercentage?: number;
}) {
  const attemptsLeft =
    test.max_attempts == null ? null : Math.max(0, test.max_attempts - test.attempts_used);
  const exhausted = attemptsLeft === 0;

  const inner = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100 line-clamp-2 min-w-0">
            {test.title}
          </p>
          {test.is_completed && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full flex-shrink-0">
              <CheckCircle2 className="w-3 h-3" /> Cleared
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
          <MiniChip icon={<FileText className="w-3 h-3" />} label={`${test.question_count} Qs`} />
          {test.time_limit_minutes ? (
            <MiniChip icon={<Clock className="w-3 h-3" />} label={`${test.time_limit_minutes} min`} />
          ) : null}
          {test.level && (
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-1 rounded-md border',
                LEVEL_META[test.level as TnpscLevel].chip,
              )}
            >
              {LEVEL_META[test.level as TnpscLevel].label}
            </span>
          )}
          {test.negative_marking && (
            <span className="text-[10px] font-semibold text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded-md">
              -{test.negative_mark_value || 0.25} neg
            </span>
          )}
          <span className="text-[10px] text-gray-500 dark:text-gray-400">
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
        </div>
      </div>

      {test.is_locked ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-lg flex-shrink-0">
          <Lock className="w-3 h-3" /> Upgrade <Sparkles className="w-3 h-3" />
        </span>
      ) : exhausted ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">
          <Lock className="w-3 h-3" /> No attempts left
        </span>
      ) : (
        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
      )}
    </>
  );

  const shell = cn(
    'flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 animate-slideUp',
  );

  if (exhausted) {
    return (
      <div className={cn(shell, 'opacity-60')} style={{ animationDelay: `${index * 0.04}s` }}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      to={test.is_locked ? '/user/subscription' : testHref(test)}
      className={cn(shell, 'transition-all hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800')}
      style={{ animationDelay: `${index * 0.04}s` }}
    >
      {inner}
    </Link>
  );
}

/**
 * "What's in the paper" — the panel beside the practice list.
 *
 * It follows the right-hand pane rather than duplicating it. Showing the three
 * sections while the right pane is deep in one section's units left the two
 * halves describing different things; now opening a section here opens it there,
 * and drilling in on the right switches this panel to that section's units and
 * their printed topics.
 */
function SyllabusPanel({
  sections,
  drill,
  collapsed,
  onCollapsedChange,
  onOpen,
}: {
  sections: SectionModel[];
  /** The section being worked through, if any — this panel follows it. */
  drill: SectionModel | null;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onOpen: (key: string | null) => void;
}) {
  const [expandAll, setExpandAll] = useState(false);
  if (sections.length === 0) return null;

  // ── Folded: a rail that says what it is and opens on a click ─────────────
  if (collapsed) {
    return (
      <aside className="hidden lg:block lg:sticky lg:top-4">
        <button
          type="button"
          onClick={() => onCollapsedChange(false)}
          aria-expanded={false}
          aria-label="Show the syllabus"
          className="w-12 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-3 flex flex-col items-center gap-2 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
        >
          <PanelLeftOpen className="w-4 h-4 text-indigo-500" />
          <span
            className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400"
            style={{ writingMode: 'vertical-rl' }}
          >
            Syllabus
          </span>
          <span className="text-[9px] tabular-nums text-gray-400">
            {drill ? drill.units.length : sections.length}
          </span>
        </button>
      </aside>
    );
  }

  // ── Drilled in: this section's units and the topics printed under them ────
  if (drill) {
    return (
      <aside className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden lg:sticky lg:top-4">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-1.5 min-w-0">
            <BookOpen className="w-4 h-4 text-indigo-500 flex-shrink-0" />
            <span className="truncate">Syllabus</span>
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full tabular-nums">
              Total Units: {drill.units.length}
            </span>
            <button
              type="button"
              onClick={() => onOpen(null)}
              aria-label="Back to all sections"
              className="p-1 rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onCollapsedChange(true)}
              aria-label="Hide the syllabus"
              className="hidden lg:inline-flex p-1 rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ul className="max-h-[calc(100vh-13rem)] overflow-y-auto scrollbar-thin p-2.5 space-y-2">
          {drill.units.map((u, i) => (
            <SyllabusRow
              key={u.key}
              index={i}
              label={u.label}
              name={u.name}
              nameTa={u.nameTa}
              count={u.questions != null ? `${u.questions} Questions` : `${u.topics.length} topics`}
              topics={u.topics}
              tamilOnly={drill.tamilOnly}
            />
          ))}
        </ul>

        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/30 px-4 py-3 flex items-start gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-px" />
          <p className="text-[10px] leading-snug text-gray-500 dark:text-gray-400">
            You can expand each unit to view the topics under it and start practising.
          </p>
        </div>
      </aside>
    );
  }

  // ── Top level: one card per section ──────────────────────────────────────
  return (
    <aside className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden lg:sticky lg:top-4">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          Syllabus
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => setExpandAll(v => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform', expandAll && 'rotate-180')} />
            {expandAll ? 'Collapse All' : 'Expand All'}
          </button>
          <button
            type="button"
            onClick={() => onCollapsedChange(true)}
            aria-label="Hide the syllabus"
            className="hidden lg:inline-flex p-1 rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[calc(100vh-13rem)] overflow-y-auto scrollbar-thin p-2.5 space-y-2">
        {sections.map((sec, i) => {
          const a = accentFor(i);
          const isOpen = expandAll;

          return (
            <div
              key={sec.key}
              className={cn(
                'rounded-xl border overflow-hidden transition-colors',
                isOpen ? a.ring : 'border-gray-100 dark:border-gray-800',
              )}
            >
              <button
                type="button"
                onClick={() => onOpen(sec.key)}
                className={cn(
                  'w-full flex items-center gap-2.5 p-2.5 text-left transition-colors',
                  isOpen ? a.soft : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                )}
              >
                <SectionGlyph name={sec.name} badge={cn(a.badge, 'w-10 h-10 rounded-xl')} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-snug">
                    {sec.name}
                  </span>
                  <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {sec.units.length} Unit{sec.units.length === 1 ? '' : 's'}
                    <span className="mx-1 text-gray-300 dark:text-gray-600">•</span>
                    {sec.countLabel}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>

              {isOpen && sec.units.length > 0 && (
                <ul className="border-t border-gray-100 dark:border-gray-800 p-1.5 space-y-1">
                  {sec.units.map((u, ui) => (
                    <SyllabusRow
                      key={u.key}
                      index={ui}
                      label={u.label}
                      name={u.name}
                      nameTa={u.nameTa}
                      count={u.questions != null ? `${u.questions} Questions` : `${u.topics.length} topics`}
                      topics={u.topics}
                      tamilOnly={sec.tamilOnly}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {!expandAll && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/30 px-4 py-6 text-center">
          <span className="inline-flex w-10 h-10 rounded-xl bg-white dark:bg-gray-900 shadow-sm items-center justify-center mb-2">
            <BookOpen className="w-5 h-5 text-indigo-300 dark:text-indigo-700" />
          </span>
          <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">
            Click on any section to view
            <br />
            the units and start practising.
          </p>
        </div>
      )}
    </aside>
  );
}

/** One expandable row — a published unit, or a catalog subject where there is none. */
function SyllabusRow({
  index,
  label,
  name,
  nameTa,
  count,
  topics,
  tamilOnly,
}: {
  index: number;
  label?: string;
  name: string;
  nameTa?: string;
  count: string;
  topics: TnpscTopic[];
  /** The Tamil paper: show the Tamil title alone. */
  tamilOnly?: boolean;
}) {
  const [open, setOpen] = useState(index === 0);
  const expandable = topics.length > 0;
  const a = accentFor(index);
  const PREVIEW = 5;

  return (
    <li className="border-t border-gray-50 dark:border-gray-800/60 first:border-t-0">
      <button
        type="button"
        onClick={() => expandable && setOpen(v => !v)}
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors',
          expandable ? 'hover:bg-gray-50 dark:hover:bg-gray-800/60' : 'cursor-default',
          open && expandable && a.soft,
        )}
      >
        <span
          className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold',
            a.badge,
          )}
        >
          {label ?? index + 1}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-gray-800 dark:text-gray-100 leading-snug">
            {tamilOnly && nameTa ? nameTa : name}
          </span>
          {!tamilOnly && nameTa && (
            <span className="block text-[10px] text-gray-500 dark:text-gray-400 leading-snug">
              {nameTa}
            </span>
          )}
          <span className="block text-[10px] text-gray-400 dark:text-gray-500">{count}</span>
        </span>

        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 flex-shrink-0 transition-transform',
            open && 'rotate-180',
            expandable ? 'text-gray-400' : 'text-transparent',
          )}
        />
      </button>

      {open && expandable && (
        <ul className="pb-2.5 pl-12 pr-3 space-y-1">
          {topics.slice(0, PREVIEW).map(t => (
            <li
              key={t.id}
              className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug flex items-start gap-1.5"
            >
              <span className={cn('w-1 h-1 rounded-full mt-1.5 flex-shrink-0', a.dot)} />
              {t.name}
            </li>
          ))}
          {topics.length > PREVIEW && (
            <li className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 pl-2.5">
              + {topics.length - PREVIEW} more topics
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

function MiniChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-md">
      {icon}
      {label}
    </span>
  );
}

function EmptyRow({ label }: { label: string }) {
  return (
    <div className="text-center py-16">
      <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
      <p className="text-sm text-gray-400 dark:text-gray-500">{label}</p>
    </div>
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
