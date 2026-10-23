import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { here } from '@/lib/report-origin';
import { skipsStageList } from '@/lib/exam-listing';
import { UserShell } from '@/components/user/UserShell';
import { useTnpscCatalog, useTnpscMockTests, useTnpscPracticeTests } from '@/hooks/use-tnpsc';
import {
  LEVELS_HIDDEN,
  LEVEL_GATE_ENABLED,
  LEVEL_META,
  MIXED_LABEL,
 SINGLE_LEVEL_BLURB,
  SINGLE_LEVEL_HEADING,
  TNPSC_LEVELS,
  VISIBLE_LEVELS,
  findStage,
  isTamilOnlySection,
  negativeMarkingLabel,
  unitDisplayName,
  answeredCount,
  questionCountLabel,
  sectionSyllabus,
  unitTopics,
  type TnpscLevel,
  type TnpscPatternSection,
  type TnpscStage,
  type TnpscSyllabusUnit,
  type TnpscTopic,
} from '@/config/tnpsc';
import { ExamLanguageNote } from '@/components/user/ExamLanguageNote';
import { useExamLanguage } from '@/hooks/use-exam-language';
import { usePassMarks } from '@/hooks/use-pass-marks';
import { mockPassPercentage } from '@/config/pass-marks';
import { hasLanguageChoice } from '@/lib/exam-language';
import { attemptsUsed } from '@/lib/plan-notice';
import { showPlanNotice } from '@/lib/plan-notice-bus';
import { fullSetFor } from '@/lib/tnpsc-full-set';
import {
  buildKeyTopicSections,
  isKeyTopicPaper,
  norm,
  sameLabel,
  type KeyTopicRow,
  type KeyTopicSection,
} from '@/lib/key-topic-sections';
import { unitChipLabel } from '@/lib/unit-chip';
import { levelStats, type LevelKey, type LevelStat } from '@/lib/unit-levels';
import { testHref, type TnpscLevelGroup, type TnpscTest } from '@/lib/tnpscApi';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  FlaskConical,
  Globe2,
  Landmark,
  KeyRound,
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
  Star,
  Timer,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * /user/exams/:groupId/:stageId
 *
 * Three tracks for a stage: Practice (untimed sets by the *published syllabus unit*
 * rather than by whatever the test catalog happens to be grouped by), Exam
 * (full-length papers by level, list rows) and Key Topics (a short paper on one topic
 * of a unit, opened from a dropdown per section).
 *
 * The unit is the organising idea on this screen. It is what the commission
 * publishes question counts against, it is what the syllabus panel on the left
 * lists, and it is therefore the thing an aspirant is actually choosing between —
 * so the unit's numeral, name and question count lead every row, and the papers
 * sit underneath it.
 */

type Tab = 'practice' | 'exam' | 'topics';

// ─── Unit presentation ────────────────────────────────────────────────────────

/**
 * Six accents, cycled by unit order.
 *
 * Deliberately positional rather than keyed by subject id: a stage can carry any
 * units, and a palette keyed by name would leave a new exam's units uncoloured.
 */
const UNIT_ACCENT = [
  { fill: 'bg-blue-500/30 hover:bg-blue-500/40 dark:bg-blue-500/25', dot: 'bg-blue-500', badge: 'bg-blue-500', soft: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400', ring: 'border-blue-200 dark:border-blue-900' },
  { fill: 'bg-emerald-500/30 hover:bg-emerald-500/40 dark:bg-emerald-500/25', dot: 'bg-emerald-500', badge: 'bg-emerald-500', soft: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', ring: 'border-emerald-200 dark:border-emerald-900' },
  { fill: 'bg-amber-500/30 hover:bg-amber-500/40 dark:bg-amber-500/25', dot: 'bg-amber-500', badge: 'bg-amber-500', soft: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', ring: 'border-amber-200 dark:border-amber-900' },
  { fill: 'bg-violet-500/30 hover:bg-violet-500/40 dark:bg-violet-500/25', dot: 'bg-violet-500', badge: 'bg-violet-500', soft: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-600 dark:text-violet-400', ring: 'border-violet-200 dark:border-violet-900' },
  { fill: 'bg-rose-500/30 hover:bg-rose-500/40 dark:bg-rose-500/25', dot: 'bg-rose-500', badge: 'bg-rose-500', soft: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-600 dark:text-rose-400', ring: 'border-rose-200 dark:border-rose-900' },
  { fill: 'bg-cyan-500/30 hover:bg-cyan-500/40 dark:bg-cyan-500/25', dot: 'bg-cyan-500', badge: 'bg-cyan-500', soft: 'bg-cyan-50 dark:bg-cyan-950/40', text: 'text-cyan-600 dark:text-cyan-400', ring: 'border-cyan-200 dark:border-cyan-900' },
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

/**
 * Current Affairs first, marked "*" instead of a numeral, with the printed units numbered from I after it.
 *
 * Current Affairs is not one of the commission's numbered units — it runs through several of them — so it
 * leads the list as its own thing rather than taking a number that would push the real units down.
 */
/** What a unit's badge shows: its numeral — or, for Current Affairs, which has none, a star (as on Key Topics). */
const CURRENT_AFFAIRS_MARK = '*';
function UnitMark({ label, index }: { label?: string; index: number }) {
  if (label === CURRENT_AFFAIRS_MARK) return <Star className="h-[18px] w-[18px] fill-amber-400 text-amber-500" aria-label="Current Affairs" />;
  return <>{label ?? index + 1}</>;
}
const isCurrentAffairs = (u: UnitRowModel) => /current\s+affairs/i.test(u.name);
function currentAffairsFirst(units: UnitRowModel[]): UnitRowModel[] {
  const current = units.filter(isCurrentAffairs).map(u => ({ ...u, label: CURRENT_AFFAIRS_MARK }));
  return current.length === 0 ? units : [...current, ...units.filter(u => !isCurrentAffairs(u))];
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

  // An explicit unit tag is decisive: the admin said which unit this paper is for,
  // so nothing below needs to be guessed at.
  const tagged = tests.filter(t => t.unit_id === unit.id);
  if (tagged.length > 0) return tagged;

  const linked = tests.filter(t => {
    if (t.unit_id && t.unit_id !== unit.id) return false; // claimed by another unit
    if (t.subject_id && subjectIds.has(t.subject_id)) return true;
    if (t.topic_id && topicIds.has(t.topic_id)) return true;
    return false;
  });
  if (linked.length > 0) return linked;

  return tests.filter(t => {
    if (t.unit_id && t.unit_id !== unit.id) return false;
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

const LEVEL_LABEL: Record<LevelKey, string> = {
  simple: 'Simple',
  medium: 'Medium',
  complex: 'Complex',
  all: MIXED_LABEL,
};

/** A paper section — the level this screen is organised at. */
interface SectionModel {
  key: string;
  name: string;
  /** The section this one is sat instead of, where the paper offers a choice. */
  alternativeTo?: string;
  questions: number;
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TnpscStagePage() {
  usePassMarks(); // the "needs N%" labels below follow the server's mock pass mark once it arrives
  const { groupId, stageId } = useParams<{ groupId: string; stageId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // The catalog as this aspirant sees it — Group 4 lists the language paper they sit, not both —
  // and the whole one, to know whether the stage offers the choice at all.
  const { groups } = useTnpscCatalog({ forMyLanguage: true });
  const { groups: allGroups } = useTnpscCatalog();
  const language = useExamLanguage();

  const found = findStage(groupId, stageId, groups);
  const offersLanguageChoice = hasLanguageChoice(findStage(groupId, stageId, allGroups)?.stage);
  // Key Topics leads, then Practice, then Exam — the order the tabs are shown in. Opening the page with no tab
  // named lands on the first of them; the other two are named in the address.
  const tabParam = searchParams.get('tab');
  const tab: Tab = tabParam === 'exam' || tabParam === 'mock' ? 'exam' : tabParam === 'practice' ? 'practice' : 'topics';
  const setTab = (t: Tab) => {
    setSearchParams(t === 'topics' ? {} : { tab: t }, { replace: true });
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
   * Open it costs a fifth of the width, which is the right trade while you are
   * deciding what to sit and the wrong one once you have decided — the unit rows
   * carry four difficulty buttons each and want the room.
   */
  const [syllabusOpen, setSyllabusOpen] = useState(false);
  const [unitFilter, setUnitFilter] = useState<string | null>(null);
  /** The Key Topics sections that are open — a dropdown each, so several can be. */
  const [openTopicSections, setOpenTopicSections] = useState<string[]>([]);
  const toggleTopicSection = (key: string) =>
    setOpenTopicSections(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  const mock = useTnpscMockTests(groupId, stageId, language);
  const practice = useTnpscPracticeTests(groupId, stageId, language);

  const stage = found?.stage;
  const group = found?.group;

  const practiceTests = useMemo<TnpscTest[]>(() => practice.subjects.flatMap(s => s.tests), [practice.subjects]);

  /** Every paper in the active track, flattened — units pick from this. */
  const trackTests = useMemo<TnpscTest[]>(
    () =>
      tab === 'exam'
        ? mock.levels.flatMap(l => l.tests)
        : // Key-topic papers are listed under Key Topics, not as a unit's own sets.
          practiceTests.filter(t => !isKeyTopicPaper(t)),
    [tab, practiceTests, mock.levels],
  );

  const keyTopicSections = useMemo<KeyTopicSection[]>(
    () => (stage ? buildKeyTopicSections(stage, practiceTests.filter(isKeyTopicPaper)) : []),
    [stage, practiceTests],
  );

  const sections = useMemo<SectionModel[]>(() => {
    if (!stage) return [];

    return (stage.pattern?.sections ?? []).map(section => {
      const built: UnitRowModel[] = section.units?.length
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
      const units = currentAffairsFirst(built);

      const subjects = sectionSyllabus(stage, section);
      const tamilOnlySection = isTamilOnlySection(section);
      let names = (subjects.length ? subjects.map(x => x.name) : units.map(u => u.name)).filter(Boolean);
      // A section whose only subject is the section itself would describe itself: list its units instead,
      // so every row says what is inside it in the same short form.
      if (names.length <= 1 && names.every(x => norm(x) === norm(section.name))) {
        names = units.map(u => (tamilOnlySection && u.nameTa ? u.nameTa : u.name)).filter(Boolean);
      }
      const blurb =
        names.length > 3 ? `${names.slice(0, 3).join(', ')} and more…` : names.join(', ');

      const inUnits = units.flatMap(u => u.tests);
      const full = fullSetFor(stage, section, trackTests);
      const seen = new Set(inUnits.map(t => t.test_id));
      const tests = full && !seen.has(full.test_id) ? [...inUnits, full] : inUnits;

      // The language paper is sat in one language or the other; a section that
      // still carries both subjects (an un-split server payload) is not Tamil-only.
      const tamilOnly = isTamilOnlySection(section);

      return {
        key: section.name,
        name: section.name,
        alternativeTo: section.alternative_to,
        questions: section.questions,
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
            className="mt-4 text-sm font-semibold text-blue-600 hover:underline"
          >
            Back to exams
          </button>
        </div>
      </UserShell>
    );
  }

  const isLoading = tab === 'exam' ? mock.isLoading : practice.isLoading;
  const error = (tab === 'exam' ? mock.error : practice.error) as Error | null;
  const drill = drillKey ? (sections.find(x => x.key === drillKey) ?? null) : null;
  const verb = tab === 'exam' ? 'Exam' : 'Practice';

  const openDrill = (key: string) => {
    setDrillKey(key);
    setUnitFilter(null);
  };

  return (
    <UserShell>
      {/* An exam with a single open stage has no stage list to go back to, so Back goes to all the examinations. */}
      <Link
        to={skipsStageList(group) ? '/user/exams' : `/user/exams/${groupId}`}
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />{' '}
        {skipsStageList(group) ? 'All examinations' : `Back to ${group.name}`}
      </Link>

      <StageHero stage={stage} groupName={group.name} accent={group.accent} onTakeMock={() => setTab('exam')} />

      {offersLanguageChoice && <ExamLanguageNote className="mb-4 sm:mb-5" />}

      {/* Syllabus beside the papers, so what's in the exam stays in view while
          picking one — 30% of the width open, a rail when folded. */}
      <div
        className={cn(
          'grid gap-4 sm:gap-5 items-start transition-[grid-template-columns] duration-200',
          syllabusOpen ? 'lg:grid-cols-[minmax(0,30fr)_minmax(0,70fr)]' : 'lg:grid-cols-[3rem_minmax(0,1fr)]',
        )}
      >
        <SyllabusPanel
          sections={sections}
          drill={tab === 'topics' ? null : drill}
          collapsed={!syllabusOpen}
          onCollapsedChange={v => setSyllabusOpen(!v)}
          // Opening a section here only opens its own dropdown, on every tab; the right-hand pane changes
          // when a section's own card is chosen there.
          onBack={() => setDrillKey(null)}
        />

        <div className="min-w-0 space-y-4">
          <TrackTabs tab={tab} onChange={setTab} />

          {isLoading ? (
            <LoadingRow
              label={tab === 'exam' ? 'Loading exam papers…' : tab === 'topics' ? 'Loading key topics…' : 'Loading practice tests…'}
            />
          ) : error ? (
            <ErrorRow message={error.message} />
          ) : tab === 'topics' ? (
            <>
              <TrackBanner tab={tab} />
              <KeyTopicsTrack
                sections={keyTopicSections}
                open={openTopicSections}
                onToggle={k => toggleTopicSection(k)}
              />
            </>
          ) : tab === 'exam' ? (
            // Ahead of the sections guard: a mock belongs to no section, so a
            // stage whose syllabus has not been published still has mocks to sit.
            <ExamTrack levels={mock.levels} totalQuestions={answeredCount(stage.pattern)} pattern={stage.pattern} />
          ) : sections.length === 0 ? (
            <EmptyRow label="No sections are published for this stage yet." />
          ) : drill ? (
            <>
              <DrillHeader section={drill} verb={verb} onBack={() => setDrillKey(null)} />

              {drill.units.length > 1 && (
                <UnitFilterPills
                  units={drill.units}
                  value={unitFilter}
                  onChange={setUnitFilter}
                  tamilOnly={drill.tamilOnly}
                />
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
                      passPercentage={mock.levels[0]?.required_percentage ?? mockPassPercentage()}
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

// ─── Key topics track ─────────────────────────────────────────────────────────

/**
 * Key topics: each printed section is a dropdown, and opening it lists the topics that have a paper.
 *
 * A topic with one paper is itself the way in — pressing it starts the paper, with the lock and
 * attempts-spent rules the other lists have. A topic with several (different difficulties) lists
 * them under its name.
 */
function KeyTopicsTrack({
  sections,
  open,
  onToggle,
}: {
  sections: KeyTopicSection[];
  open: string[];
  onToggle: (key: string) => void;
}) {
  if (sections.length === 0) return <EmptyRow label="No sections are published for this stage yet." />;

  const tests = sections.reduce((n, sec) => n + sec.testCount, 0);

  return (
    <>
      {tests === 0 && (
        <EmptyRow label="Key-topic tests are on the way. Each one covers a single topic of the syllabus." />
      )}
      <div className="space-y-2.5">
        {sections.map((sec, i) => {
          const a = accentFor(i);
          const available = sec.topicCount > 0;
          const isOpen = available && open.includes(sec.key);
          return (
            <section
              key={sec.key}
              className={cn(
                'rounded-2xl border overflow-hidden transition-colors',
                // An open section keeps its accent on the border only; the tint behind the cards made the whole list read as one block of colour.
                isOpen ? cn(a.ring, 'bg-white dark:bg-gray-900') : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
              )}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                disabled={!available}
                onClick={() => onToggle(sec.key)}
                className="w-full flex items-center gap-3 p-4 text-left disabled:cursor-default"
              >
                <SectionGlyph name={sec.name} badge={a.badge} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100">{sec.name}</h3>
                    {sec.alternativeTo && (
                      <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded-full">
                        or {sec.alternativeTo}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mt-0.5">
                    {available
                      ? `${sec.topicCount} key topic${sec.topicCount === 1 ? '' : 's'} · ${sec.testCount} test${sec.testCount === 1 ? '' : 's'}`
                      : 'Coming soon'}
                  </p>
                </div>
                {available && (
                  <ChevronDown
                    className={cn('w-5 h-5 flex-shrink-0 text-gray-400 transition-transform', isOpen && 'rotate-180')}
                    aria-hidden
                  />
                )}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-4">
                  {sec.groups.map(g => (
                    <div key={g.key}>
                      {/* A published unit is always named, even when it is the only one with a paper yet. */}
                      {(sec.groups.length > 1 || g.label || g.star) && (
                        <p className={cn('mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider', a.text)}>
                          {g.star && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden />}
                          {g.label ? `Unit ${g.label} · ` : ''}
                          {g.name}
                        </p>
                      )}
                      <ul className="overflow-hidden rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:divide-gray-800">
                        {g.topics.map((r, ri) => (
                          <KeyTopicItem key={r.topic.id} row={r} index={ri} />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function KeyTopicItem({ row, index }: { row: KeyTopicRow; index: number }) {
  const { topic, tests } = row;
  // One paper: the topic is the paper, so the row starts it.
  if (tests.length === 1) {
    return (
      <li>
        <KeyTopicLine test={tests[0]} number={index + 1} label={topic.name} />
      </li>
    );
  }
  // Several papers on one topic (different difficulties): the topic names the row, each paper sits under it.
  return (
    <li>
      <p className="flex items-center gap-3 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900 dark:bg-gray-800/50 dark:text-gray-100">
        <span className="w-6 text-center text-[11px] font-bold tabular-nums text-gray-400">{index + 1}</span>
        {topic.name}
      </p>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {tests.map(t => (
          <li key={t.test_id}>
            <KeyTopicLine test={t} nested />
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * One key-topic paper as a line in a list: its number, its name, what is in it, how you stand, and a plain
 * "Start". Dense on purpose — a unit with twenty topics should read as a list, not a wall of cards.
 */
function KeyTopicLine({
  test,
  number,
  label,
  nested = false,
}: {
  test: TnpscTest;
  number?: number;
  label?: string;
  nested?: boolean;
}) {
  const attemptsLeft = test.max_attempts == null ? null : Math.max(0, test.max_attempts - test.attempts_used);
  const exhausted = attemptsLeft === 0;

  const status = test.is_completed
    ? { text: test.best_percentage != null ? `Cleared · ${Math.round(test.best_percentage)}%` : 'Cleared', cls: 'text-emerald-600 dark:text-emerald-400 font-semibold' }
    : test.best_percentage != null
      ? { text: `Best ${Math.round(test.best_percentage)}%`, cls: 'text-gray-700 dark:text-gray-200 font-semibold' }
      : test.attempts_used > 0
        ? { text: `${test.attempts_used} attempt${test.attempts_used === 1 ? '' : 's'}`, cls: 'text-gray-600 dark:text-gray-300' }
        : { text: 'Not attempted', cls: 'text-gray-400 dark:text-gray-500' };

  const body = (
    <>
      <span className={cn('w-6 flex-shrink-0 text-center text-[11px] font-bold tabular-nums text-gray-400', nested && 'invisible')}>
        {number ?? ''}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{label ?? test.title}</span>
        {/* On a phone the figures sit under the name; from `sm` they have their own columns. */}
        <span className="block text-[11px] text-gray-500 sm:hidden">
          {test.question_count} Qs · <span className={status.cls}>{status.text}</span>
        </span>
      </span>
      <span className="hidden w-16 flex-shrink-0 text-right text-xs tabular-nums text-gray-500 sm:block dark:text-gray-400">
        {test.question_count} Qs
      </span>
      <span className={cn('hidden w-32 flex-shrink-0 text-right text-xs sm:block', status.cls)}>
        {test.is_completed && <CheckCircle2 className="mr-1 inline h-3 w-3 align-[-2px]" />}
        {status.text}
      </span>
      <span className="w-20 flex-shrink-0 text-right">
        {test.is_locked ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <Lock className="h-3 w-3" /> Upgrade
          </span>
        ) : exhausted ? (
          <span className="text-[11px] font-semibold text-gray-400">No attempts</span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-orange-600 group-hover/kt:text-orange-700 dark:text-orange-400">
            Start <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover/kt:translate-x-0.5" />
          </span>
        )}
      </span>
    </>
  );

  const row = 'group/kt flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-orange-50/60 dark:hover:bg-orange-950/20';
  if (exhausted) {
    return (
      <button type="button" onClick={() => showPlanNotice(attemptsUsed(test.max_attempts))} className={cn(row, 'opacity-70 hover:opacity-100')}>
        {body}
      </button>
    );
  }
  return (
    <Link to={test.is_locked ? '/user/subscription' : testHref(test)} state={{ from: here() }} className={row}>
      {body}
    </Link>
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
  pattern,
}: {
  levels: TnpscLevelGroup[];
  totalQuestions?: number;
  /** The official paper's shape, so the banner can say exactly how closely a mock follows it. */
  pattern?: TnpscStage['pattern'];
}) {
  const passPercentage = levels[0]?.required_percentage ?? mockPassPercentage();

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
      {/* A mock is the real thing in rehearsal: the banner says how closely it follows the official paper. */}
      <div className="rounded-2xl border border-emerald-200 bg-white p-4 dark:border-emerald-900/60 dark:bg-gray-900">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            <img src={`${import.meta.env.BASE_URL}tnpsc-logo.png`} alt="TNPSC" className="h-8 w-8 object-contain" draggable={false} />
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
              Just like the official exam
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Official pattern
              </span>
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
              Every mock is set to the real exam pattern, in one sitting — the same paper structure you will face on the day.{' '}
              {LEVEL_GATE_ENABLED ? (
                <>
                  Score <b>{passPercentage}% or more</b> in a Simple mock to unlock Medium, and in a Medium mock to unlock Complex.
                </>
              ) : (
                <>
                  A paper counts as <b>cleared</b> once you score {passPercentage}% or more.
                </>
              )}
            </p>
          </div>
        </div>
        {pattern && (
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { icon: <FileText className="h-3.5 w-3.5" />, label: `${totalQuestions ?? pattern.total_questions} questions` },
              { icon: <Layers className="h-3.5 w-3.5" />, label: `${pattern.total_marks} marks` },
              {
                icon: <Clock className="h-3.5 w-3.5" />,
                label: `${pattern.duration_minutes % 60 === 0 ? pattern.duration_minutes / 60 : (pattern.duration_minutes / 60).toFixed(1)} hours`,
              },
              {
                icon: <AlertCircle className="h-3.5 w-3.5" />,
                label: pattern.negative_marking
                  ? `Negative marking${pattern.negative_mark_value ? ` (−${pattern.negative_mark_value})` : ''}`
                  : 'No negative marking',
              },
            ].map(chip => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                {chip.icon}
                {chip.label}
              </span>
            ))}
          </div>
        )}
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
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center flex-shrink-0">
          <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
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
  tamilOnly,
}: {
  units: UnitRowModel[];
  value: string | null;
  onChange: (v: string | null) => void;
  /** The Tamil paper names its units in Tamil; every other section reads in English. */
  tamilOnly: boolean;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin pb-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          'flex-shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-bold transition-colors',
          value == null
            ? 'bg-brand-600 text-white'
            : 'border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-blue-300',
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
                ? 'border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-brand-300'
                : 'border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-blue-300',
            )}
          >
            <span className={cn('w-1.5 h-1.5 rounded-full', accentFor(i).dot)} />
            {unitChipLabel(u, tamilOnly)}
          </button>
        );
      })}
    </div>
  );
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
    <section className="group/row relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:shadow-none">
      {/* A wash of the section's colour from the corner the glyph sits in. */}
      <div aria-hidden className={cn('pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full opacity-60 blur-2xl', a.soft)} />
      <div className="relative p-3.5 flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <SectionGlyph name={section.name} badge={a.badge} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] sm:text-base font-bold text-gray-900 dark:text-gray-100">
              {section.name}
            </h3>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', a.soft, a.text)}>
              {section.units.length} Unit{section.units.length === 1 ? '' : 's'}
            </span>
            {section.alternativeTo && (
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 px-1.5 py-0.5 rounded-full">
                or {section.alternativeTo}
              </span>
            )}
          </div>
          {/* A blurb that only repeats the section's name says nothing. */}
          {section.blurb && norm(section.blurb) !== norm(section.name) && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug line-clamp-1">
              {section.blurb}
            </p>
          )}
        </div>

        {/* Fixed widths, so the two tiles are in the same place on every row. */}
        <div className="flex flex-col gap-1.5 flex-shrink-0 w-full sm:w-auto sm:self-center">
          <ActionTile
            icon={<ListChecks className="w-4 h-4" />}
            title={`Unit-wise ${verb}`}
            accent={a}
            primary
            onClick={onDrill}
            disabled={section.units.length === 0}
          />
          <ActionTile
            icon={<Layers className="w-4 h-4" />}
            title={`Full Set ${verb}`}
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
  // The English language paper, as the Tamil one has its letter — the first letter of its alphabet, as அ is Tamil's; not a unit that merely mentions English.
  const englishPaper = /^general english$|^english$/i.test(name.trim());

  return (
    <span
      className={cn(
        'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm ring-2 ring-white dark:ring-gray-900',
        badge,
      )}
      aria-hidden
    >
      {tamilPaper ? (
        <span className="text-lg font-bold leading-none">அ</span>
      ) : englishPaper ? (
        <span className="text-lg font-bold leading-none">A</span>
      ) : (
        <Icon className="w-5 h-5" />
      )}
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
  accent,
  primary,
  disabled,
  to,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  accent: (typeof UNIT_ACCENT)[number];
  /** The main way in: a solid button. The other is outlined. */
  primary?: boolean;
  disabled?: boolean;
  /** Set when the button launches a paper. */
  to?: string;
  onClick?: () => void;
}) {
  const shell = cn(
    'group inline-flex items-center justify-between gap-2 rounded-full border px-3 py-1 text-xs font-bold transition-all',
    'w-full whitespace-nowrap sm:w-[11.5rem]',
    disabled
      ? 'border-gray-200 bg-gray-50 text-gray-400 opacity-60 cursor-not-allowed dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-600'
      : primary
        ? cn(accent.soft, accent.text, 'border-transparent hover:brightness-95 active:scale-[0.98]')
        : cn('bg-white dark:bg-gray-900', accent.ring, accent.text, 'hover:shadow-sm active:scale-[0.98]'),
  );

  const body = (
    <>
      <span className="inline-flex items-center gap-2">
        {icon}
        {title}
      </span>
      {!disabled && <ChevronRight className="w-4 h-4 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />}
    </>
  );

  if (to && !disabled) {
    return (
      <Link to={to} state={{ from: here() }} className={shell}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={shell}>
      {body}
    </button>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function StageHero({
  stage,
  groupName,
  accent,
  onTakeMock,
}: {
  stage: TnpscStage;
  groupName: string;
  accent: string;
  /** Opens the exam (full mock) tab. */
  onTakeMock?: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm mb-4 sm:mb-5">
      <div className={cn('h-1.5 w-full bg-gradient-to-r', accent)} />

     <div className="relative p-5 sm:p-6">
        {/* From a laptop up the paper's name sits on the left and the mock button and figures beside it on the right;
            below that they stack, as there is not room for both. */}
        <div className="flex items-start justify-between gap-4 flex-wrap lg:flex-nowrap lg:items-center">
          <div className="min-w-0 lg:flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
              {groupName}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {stage.name}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1.5 max-w-xl leading-relaxed">
              {stage.description}
            </p>
          </div>

          {stage.pattern && (
            // On a phone the button and the figures each take the full width, one under the other, so nothing is cut
            // off at the edge; from a tablet up they sit side by side.
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4 sm:flex-shrink-0 sm:flex-wrap lg:flex-nowrap lg:ml-auto">
              {onTakeMock && <TakeMockCta onClick={onTakeMock} />}
              <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:gap-2.5 sm:flex-wrap lg:flex-nowrap">
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
  indigo: 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400',
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
    <div className="flex flex-col items-center gap-1 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-2 text-center shadow-sm sm:flex-row sm:gap-2.5 sm:px-3 sm:text-left">
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

/**
 * The three tracks as the path to follow: Key Topics, then Practice, then Exam. The step you are on is highlighted,
 * and a line under the bar says what that step is for.
 */
const PATH_STEPS: Array<{ key: Tab; label: string; icon: React.ReactNode; note: string; tag?: string }> = [
  { key: 'topics', label: 'Key Topics', icon: <KeyRound className="w-4 h-4" />, note: 'Start here — a short test on one topic at a time.' },
  { key: 'practice', label: 'Practice', icon: <Pencil className="w-4 h-4" />, note: 'Then practise whole units, at the level you choose.' },
  { key: 'exam', label: 'Exam', icon: <FileText className="w-4 h-4" />, note: 'Finish with a full-length paper, set exactly like the official exam.', tag: 'Official pattern' },
];

function TrackTabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const at = PATH_STEPS.findIndex(s => s.key === tab);
  return (
    <div>
      <div role="tablist" aria-label="Preparation path" className="flex flex-wrap items-center gap-1.5">
        {PATH_STEPS.map((it, i) => {
          const active = i === at;
          return (
            <div key={it.key} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight
                  className={cn('h-4 w-4 shrink-0', i <= at ? 'text-orange-400' : 'text-gray-300 dark:text-gray-600')}
                  aria-hidden
                />
              )}
              <button
                role="tab"
                aria-selected={active}
                aria-current={active ? 'step' : undefined}
                onClick={() => onChange(it.key)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all',
                  active
                    ? 'border-transparent bg-gradient-to-r from-brand-600 to-brand-400 text-white shadow-md shadow-orange-200/60 dark:shadow-none'
                    : i < at
                      ? 'border-orange-200 bg-white text-gray-700 hover:border-orange-300 dark:border-orange-900/60 dark:bg-gray-900 dark:text-gray-200'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold',
                    active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                  )}
                >
                  {i + 1}
                </span>
                {it.icon}
                {it.label}
                {it.tag && (
                  <span
                    className={cn(
                      'hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold sm:inline-flex',
                      active ? 'bg-white/25 text-white' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
                    )}
                  >
                    <img src={`${import.meta.env.BASE_URL}tnpsc-logo.png`} alt="" className="h-3.5 w-3.5 object-contain" draggable={false} />
                    {it.tag}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
      {at >= 0 && (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-orange-600 dark:text-orange-400">
            Step {at + 1} of {PATH_STEPS.length}
          </span>{' '}
          · {PATH_STEPS[at].note}
        </p>
      )}
    </div>
  );
}
function TrackBanner({ tab }: { tab: Tab }) {
  const practice = tab === 'practice';
  const topics = tab === 'topics';
  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="relative flex items-start gap-3">
        <span className="w-11 h-11 rounded-xl bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center flex-shrink-0">
          <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {topics ? 'Choose a Key Topic' : practice ? 'Choose Your Practice' : 'Choose Your Exam'}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">
            {topics
              ? 'Open a section, pick a key topic and take a short test on just that topic.'
              : `Select a subject to start unit-wise ${practice ? 'practice' : 'papers'}, or try the full set for a complete ${practice ? 'revision' : 'sitting'}.`}
          </p>
        </div>
      </div>

      {/* Decorative only — hidden from assistive tech and from narrow screens. */}
      <Sparkles
        aria-hidden
        className="hidden sm:block absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 text-brand-200 dark:text-blue-900"
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
            // Current Affairs has no numeral: a white badge with a gold edge and a gold star, not a coloured one.
            unit.label === CURRENT_AFFAIRS_MARK ? 'bg-white border-2 border-amber-400 dark:bg-gray-900' : a.badge,
          )}
        >
          <UnitMark label={unit.label} index={index} />
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
          {unit.questions == null && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{unit.topics.length} topics</p>
          )}
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
      : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-brand-300 border-blue-200 dark:border-blue-900',
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
      state={{ from: here() }}
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
    // On a phone the icon and text sit on one row and the button takes the full width beneath them;
    // side by side only from `sm` up. (Side by side on a narrow screen squeezed the text into a sliver.)
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <span className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
          <Layers className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Full Set {verb}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
            Take the complete set of questions from all units in one sitting.
          </p>
        </div>
      </div>

      <Link
        to={test.is_locked ? '/user/subscription' : testHref(test)}
        state={{ from: here() }}
        className="inline-flex w-full sm:w-auto items-center justify-between sm:justify-start gap-2.5 rounded-xl bg-brand-600 px-3.5 py-2.5 text-white transition-all hover:bg-brand-700 hover:shadow-md flex-shrink-0"
      >
        <span className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
          {test.is_locked ? <Lock className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
        </span>
        <span className="text-left">
          <span className="block text-xs font-bold leading-tight">{section.name}</span>
          <span className="block text-[10px] opacity-80">All units</span>
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
  label,
  compact = false,
}: {
  test: TnpscTest;
  index: number;
  /** What the row is called, when that is not the paper's own title — a key topic is named for its topic. */
  label?: string;
  /** Shown alongside a below-par best score. Omitted for ungated practice sets. */
  passPercentage?: number;
  /** A card for a grid — the name over its details over the action — rather than a full-width row. */
  compact?: boolean;
}) {
  const attemptsLeft =
    test.max_attempts == null ? null : Math.max(0, test.max_attempts - test.attempts_used);
  const exhausted = attemptsLeft === 0;

  const title = (
    <div className="flex items-start gap-2">
      <p
        className={cn(
          'font-extrabold text-gray-900 dark:text-gray-100 line-clamp-2 min-w-0',
          // Two lines kept in a card, so a short name and a long one leave the buttons level.
          compact ? 'text-[13px] leading-snug min-h-[2.1rem]' : 'text-[15px]',
        )}
      >
        {label ?? test.title}
      </p>
      {test.is_completed && (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full flex-shrink-0">
          <CheckCircle2 className="w-3 h-3" /> Cleared
        </span>
      )}
    </div>
  );

  const meta = (
    <div className={cn('flex items-center gap-1.5 flex-wrap', !compact && 'mt-1.5')}>
      <MiniChip icon={<FileText className="w-3 h-3" />} label={`${test.question_count} Qs`} />
      {test.time_limit_minutes ? (
        <MiniChip icon={<Clock className="w-3 h-3" />} label={`${test.time_limit_minutes} min`} />
      ) : null}
      {/* A mock is built across all three difficulties, and while the portal shows a
          single level the group is headed "Exam Pattern" rather than naming one — so a
          "Simple" chip on each paper contradicted its own heading. */}
      {test.level && !LEVELS_HIDDEN && (
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
  );

  // In a card the action is a small button at the right of the details row, not a bar across the card.
  const action = test.is_locked ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-1 rounded-lg flex-shrink-0">
      <Lock className="w-3 h-3" /> Upgrade <Sparkles className="w-3 h-3" />
    </span>
  ) : exhausted ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">
      <Lock className="w-3 h-3" /> No attempts left
    </span>
  ) : (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg bg-orange-500 group-hover/paper:bg-orange-600 text-white font-bold shadow-sm flex-shrink-0',
        // A card's action is a small button; a full-width row keeps the larger one.
        compact ? 'h-6 px-2.5 text-[11px]' : 'h-8 px-3 text-xs',
      )}
    >
      Start <ChevronRight className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
    </span>
  );

  const inner = compact ? (
    <>
      {title}
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1">{meta}</div>
        {action}
      </div>
    </>
  ) : (
    <>
      <div className="min-w-0 flex-1">
        {title}
        {meta}
      </div>
      {action}
    </>
  );

  const shell = cn(
    compact ? 'flex h-full flex-col justify-between gap-3 rounded-xl border-2 p-3 animate-slideUp' : 'flex items-center gap-3 rounded-xl border-2 p-4 animate-slideUp',
    test.is_locked || exhausted
      ? 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
      : 'border-orange-200 dark:border-orange-900/60 bg-gradient-to-r from-orange-50/70 to-white dark:from-orange-950/20 dark:to-gray-900 shadow-sm',
  );

  if (exhausted) {
    // Spent attempts are a dead end for this paper, but not for the person: the popup says so and
    // points at the plans. (The row stays dimmed — it is still not something to start.)
    return (
      <button
        type="button"
        onClick={() => showPlanNotice(attemptsUsed(test.max_attempts))}
        className={cn(shell, 'w-full text-left opacity-70 transition-all hover:opacity-100 hover:border-amber-200 dark:hover:border-amber-800')}
        style={{ animationDelay: `${index * 0.04}s` }}
      >
        {inner}
      </button>
    );
  }

  return (
    <Link
      to={test.is_locked ? '/user/subscription' : testHref(test)}
      state={{ from: here() }}
      className={cn(shell, 'group/paper transition-all hover:shadow-md hover:border-orange-400 dark:hover:border-orange-700')}
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
/** The phone's way to open the syllabus, which starts folded. Not shown on desktop, where the panel is always open. */
function MobileSyllabusToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="lg:hidden w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
    >
      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-900 dark:text-gray-100">
        <BookOpen className="w-4 h-4 text-blue-500" />
        Syllabus
      </span>
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
        {open ? 'Hide' : 'Show'}
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </span>
    </button>
  );
}

function SyllabusPanel({
  sections,
  drill,
  collapsed,
  onCollapsedChange,
  onBack,
}: {
  sections: SectionModel[];
  /** The section being worked through, if any — this panel follows it. */
  drill: SectionModel | null;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** Leaves the drill-down the right-hand pane is showing. */
  onBack: () => void;
}) {
  // Which sections' dropdowns are open here. Kept apart from the right-hand pane on every tab, so opening one
  // here never moves it and what is open on the right never moves this.
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const toggleOpen = (key: string) =>
    setOpenKeys(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  // "Expand all" is just every section open: no separate flag to override a single section's own click.
  const allKeys = sections.map(s => s.key);
  const allOpen = allKeys.length > 0 && allKeys.every(k => openKeys.includes(k));
  const toggleAll = () => setOpenKeys(allOpen ? [] : allKeys);
  // On a phone the syllabus starts folded, so the papers are what the page opens on. Desktop ignores this.
  const [mobileOpen, setMobileOpen] = useState(false);
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
          className="w-12 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-3 flex flex-col items-center gap-2 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
        >
          <PanelLeftOpen className="w-4 h-4 text-blue-500" />
          <span
            className="text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400"
            style={{ writingMode: 'vertical-rl' }}
          >
            Syllabus
          </span>
        </button>
      </aside>
    );
  }

  // ── Drilled in: this section's units and the topics printed under them ────
  if (drill) {
    return (
      <aside className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden lg:sticky lg:top-4">
        <MobileSyllabusToggle open={mobileOpen} onToggle={() => setMobileOpen(v => !v)} />
        <div className={cn(mobileOpen ? 'flex' : 'hidden', 'lg:flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800')}>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-1.5 min-w-0">
            <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="truncate">Syllabus</span>
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-full tabular-nums">
              Total Units: {drill.units.length}
            </span>
            <button
              type="button"
              onClick={onBack}
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

        <ul className={cn(mobileOpen ? 'block' : 'hidden', 'lg:block max-h-[calc(100vh-13rem)] overflow-y-auto scrollbar-thin p-2.5 space-y-2')}>
          {drill.units.map((u, i) => (
            <SyllabusRow
              key={u.key}
              index={i}
              label={u.label}
              name={u.name}
              nameTa={u.nameTa}
              count={u.questions != null ? undefined : `${u.topics.length} topics`}
              topics={u.topics}
              tamilOnly={drill.tamilOnly}
            />
          ))}
        </ul>

        <div className={cn(mobileOpen ? 'flex' : 'hidden', 'lg:flex border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/30 px-4 py-3 items-start gap-2')}>
          <BookOpen className="w-4 h-4 text-blue-400 flex-shrink-0 mt-px" />
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
        <MobileSyllabusToggle open={mobileOpen} onToggle={() => setMobileOpen(v => !v)} />
      <div className={cn(mobileOpen ? 'flex' : 'hidden', 'lg:flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800')}>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-blue-500" />
          Syllabus
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={toggleAll}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-[10px] font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform', allOpen && 'rotate-180')} />
            {allOpen ? 'Collapse All' : 'Expand All'}
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

      <div className={cn(mobileOpen ? 'block' : 'hidden', 'lg:block max-h-[calc(100vh-13rem)] overflow-y-auto scrollbar-thin p-2.5 space-y-2')}>
        {sections.map((sec, i) => {
          const a = accentFor(i);
          const isOpen = openKeys.includes(sec.key);

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
                onClick={() => toggleOpen(sec.key)}
                aria-expanded={isOpen}
                className={cn(
                  'w-full flex items-center gap-2.5 p-2.5 text-left transition-colors',
                  isOpen ? 'bg-gray-50 dark:bg-gray-800/50' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                )}
              >
                <SectionGlyph name={sec.name} badge={cn(a.badge, 'w-10 h-10 rounded-xl')} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold text-gray-900 dark:text-gray-100 leading-snug">
                    {sec.name}
                  </span>
                  <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {sec.units.length} Unit{sec.units.length === 1 ? '' : 's'}
                  </span>
                </span>
                <ChevronRight className={cn('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform', isOpen && 'rotate-90')} />
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
                      count={u.questions != null ? undefined : `${u.topics.length} topics`}
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

      {!allOpen && (
        <div className="border-t border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/30 px-4 py-6 text-center">
          <span className="inline-flex w-10 h-10 rounded-xl bg-white dark:bg-gray-900 shadow-sm items-center justify-center mb-2">
            <BookOpen className="w-5 h-5 text-brand-300 dark:text-blue-700" />
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
  /** A line under the name — omitted when there is nothing to say. */
  count?: string;
  topics: TnpscTopic[];
  /** The Tamil paper: show the Tamil title alone. */
  tamilOnly?: boolean;
}) {
  const [open, setOpen] = useState(index === 0);
  // "+ N more topics" opens the rest of the list in place.
  const [showAll, setShowAll] = useState(false);
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
          open && expandable && 'bg-gray-50 dark:bg-gray-800/50',
        )}
      >
        <span
          className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold',
            label === CURRENT_AFFAIRS_MARK ? 'bg-white border-2 border-amber-400 dark:bg-gray-900' : a.badge,
          )}
        >
          <UnitMark label={label} index={index} />
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
          {count && <span className="block text-[10px] text-gray-400 dark:text-gray-500">{count}</span>}
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
          {(showAll ? topics : topics.slice(0, PREVIEW)).map(t => (
            <li
              key={t.id}
              className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug flex items-start gap-1.5"
            >
              <span className={cn('w-1 h-1 rounded-full mt-1.5 flex-shrink-0', a.dot)} />
              {t.name}
            </li>
          ))}
          {topics.length > PREVIEW && (
            <li className="pl-2.5">
              <button
                type="button"
                onClick={() => setShowAll(v => !v)}
                aria-expanded={showAll}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {showAll ? 'Show fewer topics' : `+ ${topics.length - PREVIEW} more topics`}
              </button>
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
      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
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

/** The lines that rotate under the "Take Mock Exam" button, each a reason to sit a full paper. */
const MOCK_LINES = [
  'Get exam-day confidence before the real day',
  'Practise under real exam conditions',
  'Find your weak areas while there is still time',
  'See exactly where you stand against the pass mark',
];

/**
 * A call to take a full mock, placed ahead of the paper's figures. The button pulses and its arrow nudges to
 * draw the eye; the line beneath rotates through the reasons to sit one. All of it still for anyone who has
 * asked their system to reduce motion.
 */
function TakeMockCta({ onClick }: { onClick: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI(n => (n + 1) % MOCK_LINES.length), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-start sm:items-center gap-1.5 sm:max-w-[15rem]">
      <button
        type="button"
        onClick={onClick}
        className="cta-pulse group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-orange-300/50 transition-transform hover:scale-105 active:scale-95 dark:shadow-none"
      >
        <Timer className="h-4 w-4" />
        Take Mock Exam
        <ArrowRight className="cta-arrow h-4 w-4" />
      </button>
      <p key={i} className="animate-fadeIn text-center text-[11px] font-semibold leading-snug text-gray-600 dark:text-gray-300">
        {MOCK_LINES[i]}
      </p>
    </div>
  );
}
