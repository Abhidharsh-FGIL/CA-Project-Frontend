import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Info, KeyRound, Layers, ListChecks, Lock, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LEVELS_HIDDEN,
  LEVEL_META,
  MIXED_LABEL,
  PRACTICE_MAX_QUESTIONS,
  PRACTICE_MIN_QUESTIONS,
  TNPSC_GROUPS,
  TNPSC_LEVELS,
  findStage,
  findUnit,
  unitDisplayName,
  sectionCountLabel,
  stageUnits,
  subjectForUnit,
  unitTopics,
  type TnpscLevel,
  type TnpscTestType,
} from '@/config/tnpsc';
import {
  validateTnpscTag,
  type TnpscExamLanguage,
  type TnpscScope,
  type TnpscTagValue,
} from '@/lib/tnpscAdminApi';
import { FULL_PAPER_BLEND, blendTargets, describeBlend } from '@/lib/difficulty-blend';

interface Props {
  value: TnpscTagValue;
  onChange: (next: TnpscTagValue) => void;
  /** Used to show the blend a whole paper will be composed to. */
  questionCount?: number;
  /** Hide the Track selector when the parent already drives it from the mode. */
  hideTrack?: boolean;
  /**
   * What the question bank can supply for each topic of the chosen unit, by topic id - null until the
   * bank has loaded or when the caller has none. Shown beside each key topic so an admin picks one
   * the bank can fill.
   */
  categoryOptions?: Array<{ name: string; count: number }> | null;
  className?: string;
}

/**
 * Where a paper lands in the aspirant portal, asked as a cascade.
 *
 *   Exam group → Stage → Track → ┬ Practice → Scope → ┬ Unit → Level
 *                                │                    ├ Key topic → Unit → Topic → Level
 *                                │                    └ Section
 *                                └ Exam → Language → Level
 *
 * Each answer narrows the next, because the questions are not independent: a
 * mock has no unit, a section paper has no difficulty of its own, and only a
 * paper sat in one of two languages needs a language. Asking them all at once
 * produced a form where most fields were wrong for most papers.
 *
 * A paper that stands for the *whole* of something — Full Unit, a section, a
 * mock — is composed to the 20 / 30 / 50 blend rather than filtered to one
 * difficulty, and the panel says so before it is created.
 */
export function TnpscTagFields({ value, onChange, questionCount, hideTrack, categoryOptions, className }: Props) {
  const group = TNPSC_GROUPS.find(g => g.id === value.group_id);
  const stage = useMemo(
    () => findStage(value.group_id ?? undefined, value.stage_id ?? undefined)?.stage,
    [value.group_id, value.stage_id],
  );
  const units = useMemo(() => stageUnits(stage), [stage]);
  const unit = findUnit(stage, value.unit_id);
  const topics = useMemo(() => (unit ? unitTopics(stage, unit) : []), [stage, unit]);
  const sections = stage?.pattern?.sections ?? [];
  const { errors, warnings } = validateTnpscTag(value, questionCount);

  /** Group 4 is sat in Tamil or English; a stage without that choice skips it. */
  const languageSections = useMemo(() => sections.filter(sec => sec.alternative_to), [sections]);

  /**
   * True when this paper stands for the whole of something.
   *
   * A Full Unit set, a section set and every mock span the difficulty range; only
   * a unit pitched at one level does not.
   */
  const isWholePaper =
    value.track === 'mock' ||
    (value.track === 'practice' && value.scope === 'section') ||
    (value.track === 'practice' && (value.scope === 'unit' || value.scope === 'topic') && !value.level);

  /** A unit paper and a key-topic paper are both filed under a unit; only the second names a topic. */
  const inUnitFlow = value.track === 'practice' && (value.scope === 'unit' || value.scope === 'topic');

  const setGroup = (groupId: string) => {
    const g = TNPSC_GROUPS.find(x => x.id === groupId);
    const open = g?.stages.filter(st => st.status === 'active') ?? [];
    onChange({
      ...value,
      group_id: groupId,
      // Auto-select when a group has exactly one open stage (Group 4).
      stage_id: open.length === 1 ? open[0].id : null,
      unit_id: null,
      subject_id: null,
      topic_id: null,
      section_name: null,
      language: null,
    });
  };

  const setStage = (stageId: string) =>
    onChange({
      ...value,
      stage_id: stageId,
      unit_id: null,
      subject_id: null,
      topic_id: null,
      section_name: null,
      language: null,
    });

  const setTrack = (track: TnpscTestType) =>
    onChange({
      ...value,
      track,
      // A mock must have a level, so seed it; practice may legitimately have none.
      level: track === 'mock' ? (value.level ?? 'simple') : value.level,
      scope: track === 'practice' ? (value.scope ?? 'unit') : null,
      unit_id: track === 'practice' ? value.unit_id : null,
      subject_id: track === 'practice' ? value.subject_id : null,
      topic_id: track === 'practice' ? value.topic_id : null,
      section_name: track === 'practice' ? value.section_name : null,
      language: track === 'mock' ? value.language : null,
    });

  const setScope = (scope: TnpscScope) =>
    onChange({
      ...value,
      scope,
      // The two scopes describe a paper differently; carrying one into the other
      // leaves a unit on a section paper, which the portal would file twice.
      unit_id: scope !== 'section' ? value.unit_id : null,
      // Only a key topic names a topic; a whole-unit paper covers all of them.
      topic_id: scope === 'topic' ? value.topic_id : null,
      level: scope !== 'section' ? value.level : null,
      section_name: scope === 'section' ? value.section_name : null,
      subject_id: scope !== 'section' ? value.subject_id : null,
    });

  /**
   * Choosing a unit fills the subject it belongs to.
   *
   * Asked of the unit first and then of the section that prints it: the General
   * Tamil units carry no `subject_ids` of their own — all seven sit under
   * `general-tamil`, which only the section names — so reading the unit alone
   * left the required subject unset and the form unsubmittable.
   */
  const setUnit = (unitId: string) => {
    const picked = findUnit(stage, unitId);
    onChange({
      ...value,
      unit_id: unitId,
      subject_id: subjectForUnit(stage, picked) ?? value.subject_id ?? null,
      topic_id: null,
    });
  };

  const setSection = (name: string) => {
    const sec = sections.find(x => x.name === name);
    onChange({
      ...value,
      section_name: name,
      subject_id: sec?.syllabus_subject_ids?.[0] ?? sec?.subject_ids?.[0] ?? null,
    });
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* ── 1. Which exam ──────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Exam Group <span className="text-red-500">*</span></Label>
          <Select value={value.group_id ?? undefined} onValueChange={setGroup}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Select group…" /></SelectTrigger>
            <SelectContent>
              {TNPSC_GROUPS.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Stage <span className="text-red-500">*</span></Label>
          <Select value={value.stage_id ?? undefined} onValueChange={setStage} disabled={!group}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder={group ? 'Select stage…' : 'Pick a group first'} />
            </SelectTrigger>
            <SelectContent>
              {(group?.stages ?? []).map(st => (
                <SelectItem key={st.id} value={st.id} disabled={st.status !== 'active'}>
                  <span className="flex items-center gap-1.5">
                    {st.status !== 'active' && <Lock className="h-3 w-3" />}
                    {st.short_name}
                    {st.status !== 'active' && <span className="text-muted-foreground text-xs">— coming soon</span>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── 2. Practice or exam ────────────────────────────────────────── */}
      {!hideTrack && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Track <span className="text-red-500">*</span></Label>
          <div className="grid grid-cols-2 gap-2">
            <ChoiceCard
              active={value.track === 'practice'}
              onClick={() => setTrack('practice')}
              title="Practice Test"
              detail={`${PRACTICE_MIN_QUESTIONS}–${PRACTICE_MAX_QUESTIONS} Qs · unit or section`}
            />
            <ChoiceCard
              active={value.track === 'mock'}
              onClick={() => setTrack('mock')}
              title="Exam (Mock Test)"
              detail={
                stage?.pattern
                  ? `${stage.pattern.total_questions} Qs · ${stage.pattern.duration_minutes / 60}h · whole paper`
                  : 'Full-length, whole paper'
              }
            />
          </div>
        </div>
      )}

      {/* ── 3a. Practice: how much does it cover? ──────────────────────── */}
      {value.track === 'practice' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Covers <span className="text-red-500">*</span></Label>
          <div className="grid gap-2 sm:grid-cols-3">
            <ChoiceCard
              active={value.scope === 'unit'}
              onClick={() => setScope('unit')}
              icon={<ListChecks className="h-4 w-4" />}
              title="One unit"
              detail="Appears under that unit, at one difficulty"
            />
            <ChoiceCard
              active={value.scope === 'topic'}
              onClick={() => setScope('topic')}
              icon={<KeyRound className="h-4 w-4" />}
              title="A key topic"
              detail="One topic of a unit - appears under Key Topics"
            />
            <ChoiceCard
              active={value.scope === 'section'}
              onClick={() => setScope('section')}
              icon={<Layers className="h-4 w-4" />}
              title="A whole section"
              detail="Appears as that section's Full Set Practice"
            />
          </div>
        </div>
      )}

      {/* ── 3b. Exam: which language is it sat in? ─────────────────────── */}
      {value.track === 'mock' && languageSections.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            Language paper <span className="text-red-500">*</span>
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {languageSections.map(sec => {
              const lang: TnpscExamLanguage = /tamil/i.test(sec.name) ? 'tamil' : 'english';
              const others = sections.filter(x => !x.alternative_to).map(x => x.name);
              return (
                <ChoiceCard
                  key={sec.name}
                  active={value.language === lang}
                  onClick={() => onChange({ ...value, language: lang })}
                  title={sec.name}
                  detail={`${sectionCountLabel(sec)} + ${others.join(' + ')}`}
                />
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            The paper is sat in one language or the other, never both.
          </p>
        </div>
      )}

      {/* ── 4a. Unit, and the difficulty it sits behind ────────────────── */}
      {inUnitFlow && (
        <div className="space-y-3">
          <div className={cn('grid gap-3', value.scope === 'topic' && 'sm:grid-cols-2')}>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Syllabus Unit <span className="text-red-500">*</span></Label>
              <Select value={value.unit_id ?? undefined} onValueChange={setUnit} disabled={!stage}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={stage ? 'Select unit…' : 'Pick a stage first'} />
                </SelectTrigger>
                <SelectContent>
                  {units.map(({ unit: u, sectionName }) => (
                    <SelectItem key={u.id} value={u.id}>
                      <span className="flex items-center gap-1.5">
                        <span className="w-6 text-[10px] font-bold text-muted-foreground">{u.label ?? '—'}</span>
                        <span>{unitDisplayName(stage, u)}</span>
                        <span className="text-[10px] text-muted-foreground">· {u.questions} Qs · {sectionName}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {value.scope === 'topic' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Key Topic <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={value.topic_id ?? undefined}
                  onValueChange={v => onChange({ ...value, topic_id: v })}
                  disabled={!unit || !categoryOptions || categoryOptions.length === 0}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue
                      placeholder={
                        !unit
                          ? 'Pick a unit first'
                          : categoryOptions && categoryOptions.length > 0
                            ? 'Select category…'
                            : 'The bank has no categories for this unit'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(categoryOptions ?? []).map(c => (
                      <SelectItem key={c.name} value={c.name}>
                        <span className="flex items-center gap-1.5">
                          <span>{c.name}</span>
                          <span className="text-[10px] text-muted-foreground">· {c.count} in bank</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Difficulty button <span className="text-red-500">*</span></Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TNPSC_LEVELS.map(lv => (
                <ChoiceCard
                  key={lv}
                  active={value.level === lv}
                  onClick={() => onChange({ ...value, level: lv })}
                  title={LEVEL_META[lv as TnpscLevel].label}
                  detail={LEVEL_META[lv as TnpscLevel].blurb}
                  badge={LEVEL_META[lv as TnpscLevel].order}
                />
              ))}
              <ChoiceCard
                active={value.level == null}
                onClick={() => onChange({ ...value, level: null })}
                icon={<Layers className="h-4 w-4" />}
                title={MIXED_LABEL}
                detail="Spans the range — built to the standard blend"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 4b. Which section ──────────────────────────────────────────── */}
      {value.track === 'practice' && value.scope === 'section' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Section <span className="text-red-500">*</span></Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {sections.map(sec => (
              <ChoiceCard
                key={sec.name}
                active={value.section_name === sec.name}
                onClick={() => setSection(sec.name)}
                title={sec.name}
                detail={`${sectionCountLabel(sec)}${sec.units?.length ? ` · ${sec.units.length} units` : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── 5. Exam level ──────────────────────────────────────────────── */}
      {/* Not asked while the portal shows a single level: the paper is composed to
          the blend below, so choosing "Simple" for it would only mislabel it. */}
      {value.track === 'mock' && !LEVELS_HIDDEN && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Difficulty Level <span className="text-red-500">*</span></Label>
          <div className="grid grid-cols-3 gap-2">
            {TNPSC_LEVELS.map(lv => (
              <ChoiceCard
                key={lv}
                active={value.level === lv}
                onClick={() => onChange({ ...value, level: lv })}
                title={LEVEL_META[lv as TnpscLevel].label}
                detail={LEVEL_META[lv as TnpscLevel].blurb}
                badge={LEVEL_META[lv as TnpscLevel].order}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Aspirants must clear Simple before Medium unlocks, and Medium before Complex.
          </p>
        </div>
      )}

      {/* ── The blend a whole paper gets built to ──────────────────────── */}
      {isWholePaper && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-900 dark:text-brand-200">
            <Target className="h-3.5 w-3.5" /> Built to the standard blend —{' '}
            {FULL_PAPER_BLEND.easy}% Simple · {FULL_PAPER_BLEND.medium}% Medium ·{' '}
            {FULL_PAPER_BLEND.hard}% Complex
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-blue-800/80 dark:text-brand-300/80">
            {questionCount
              ? `${questionCount} questions → ${describeBlend(blendTargets(questionCount))}.`
              : 'Questions are chosen across the range rather than at one difficulty.'}{' '}
            A paper standing for the whole of something has to span what the real exam spans.
          </p>
        </div>
      )}

      {/* ── Where it will appear ───────────────────────────────────────── */}
      {value.track === 'practice' && value.scope === 'topic' && unit && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          Appears under <span className="font-semibold">Key Topics</span> →{' '}
          <span className="font-semibold">
            {unit.label ? `Unit ${unit.label}: ` : ''}{unitDisplayName(stage, unit)}
          </span>
          {value.topic_id ? `: ${value.topic_id}` : ''}.{' '}
          If the server has no such topic yet it is kept in the paper’s title, so leave the “Unit: Topic” part of the
          suggested title as it is.
        </p>
      )}
      {value.track === 'practice' && value.scope === 'unit' && unit && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          Appears under{' '}
          <span className="font-semibold">
            {unit.label ? `Unit ${unit.label}: ` : ''}{unitDisplayName(stage, unit)}
          </span>
          {/* A Tamil unit's name is already the Tamil one; a gloss would repeat it. */}
          {unit.name_ta && unitDisplayName(stage, unit) === unit.name ? ` (${unit.name_ta})` : ''} —{' '}
          {value.level ? `${LEVEL_META[value.level].label} button` : `${MIXED_LABEL} button`}.
        </p>
      )}

      {/* ── Feedback ───────────────────────────────────────────────────── */}
      {errors.length > 0 && (
        <ul className="space-y-1">
          {errors.map(e => (
            <li key={e} className="flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {e}
            </li>
          ))}
        </ul>
      )}
      {warnings.map(w => (
        <p key={w} className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" /> {w}
        </p>
      ))}
    </div>
  );
}

/** One selectable card. Used for every step of the cascade, so they read alike. */
function ChoiceCard({
  active,
  onClick,
  title,
  detail,
  icon,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail: string;
  icon?: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-lg border px-3 py-2.5 text-left transition-all',
        active
          ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300 dark:bg-blue-950/40 dark:ring-brand-700'
          : 'border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700',
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-semibold">
        {badge != null && (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] dark:bg-slate-800">
            {badge}
          </span>
        )}
        {icon}
        {title}
      </span>
      <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground line-clamp-2">
        {detail}
      </span>
    </button>
  );
}
