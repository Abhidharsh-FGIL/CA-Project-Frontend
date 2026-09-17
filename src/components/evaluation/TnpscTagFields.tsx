import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Info, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LEVEL_META,
  PRACTICE_MAX_QUESTIONS,
  PRACTICE_MIN_QUESTIONS,
  TNPSC_GROUPS,
  TNPSC_LEVELS,
  findStage,
  type TnpscLevel,
  type TnpscTestType,
} from '@/config/tnpsc';
import { validateTnpscTag, type TnpscTagValue } from '@/lib/tnpscAdminApi';

interface Props {
  value: TnpscTagValue;
  onChange: (next: TnpscTagValue) => void;
  /** Used to warn when the paper size doesn't fit the track (200 for mock, 30–50 for practice). */
  questionCount?: number;
  /** Hide the Track selector when the parent already drives it from the assessment mode. */
  hideTrack?: boolean;
  className?: string;
}

/**
 * Group → Stage → Track → (Level | Subject → Topic).
 * The five fields that decide where a paper appears in the aspirant portal.
 */
export function TnpscTagFields({ value, onChange, questionCount, hideTrack, className }: Props) {
  const group = TNPSC_GROUPS.find(g => g.id === value.group_id);
  const stage = useMemo(
    () => findStage(value.group_id ?? undefined, value.stage_id ?? undefined)?.stage,
    [value.group_id, value.stage_id],
  );
  const subject = stage?.subjects.find(s => s.id === value.subject_id);
  const { errors, warnings } = validateTnpscTag(value, questionCount);

  const setGroup = (groupId: string) => {
    const g = TNPSC_GROUPS.find(x => x.id === groupId);
    const onlyStage = g?.stages.filter(s => s.status === 'active') ?? [];
    onChange({
      ...value,
      group_id: groupId,
      // Auto-select when a group has exactly one open stage (Group 4).
      stage_id: onlyStage.length === 1 ? onlyStage[0].id : null,
      subject_id: null,
      topic_id: null,
    });
  };

  const setStage = (stageId: string) =>
    onChange({ ...value, stage_id: stageId, subject_id: null, topic_id: null });

  const setTrack = (track: TnpscTestType) =>
    onChange({
      ...value,
      track,
      level: track === 'mock' ? value.level ?? 'simple' : null,
      subject_id: track === 'practice' ? value.subject_id : null,
      topic_id: track === 'practice' ? value.topic_id : null,
    });

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Group */}
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

        {/* Stage */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Stage <span className="text-red-500">*</span></Label>
          <Select value={value.stage_id ?? undefined} onValueChange={setStage} disabled={!group}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder={group ? 'Select stage…' : 'Pick a group first'} />
            </SelectTrigger>
            <SelectContent>
              {(group?.stages ?? []).map(s => (
                <SelectItem key={s.id} value={s.id} disabled={s.status !== 'active'}>
                  <span className="flex items-center gap-1.5">
                    {s.status !== 'active' && <Lock className="h-3 w-3" />}
                    {s.short_name}
                    {s.status !== 'active' && <span className="text-muted-foreground text-xs">— coming soon</span>}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Track */}
      {!hideTrack && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Track <span className="text-red-500">*</span></Label>
          <div className="grid grid-cols-2 gap-2">
            <TrackCard
              active={value.track === 'mock'}
              onClick={() => setTrack('mock')}
              title="Mock Test"
              detail={
                stage?.pattern
                  ? `${stage.pattern.total_questions} Qs · ${stage.pattern.duration_minutes / 60}h · level gated`
                  : 'Full-length, level gated'
              }
            />
            <TrackCard
              active={value.track === 'practice'}
              onClick={() => setTrack('practice')}
              title="Practice Test"
              detail={`${PRACTICE_MIN_QUESTIONS}–${PRACTICE_MAX_QUESTIONS} Qs · subject wise`}
            />
          </div>
        </div>
      )}

      {/* Level (mock) */}
      {value.track === 'mock' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Difficulty Level <span className="text-red-500">*</span></Label>
          <div className="grid grid-cols-3 gap-2">
            {TNPSC_LEVELS.map(lv => (
              <button
                key={lv}
                type="button"
                onClick={() => onChange({ ...value, level: lv })}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition-all',
                  value.level === lv
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-300 dark:ring-indigo-700'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
                )}
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px]">
                    {LEVEL_META[lv as TnpscLevel].order}
                  </span>
                  {LEVEL_META[lv as TnpscLevel].label}
                </span>
                <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground line-clamp-2">
                  {LEVEL_META[lv as TnpscLevel].blurb}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Aspirants must clear Simple before Medium unlocks, and Medium before Complex.
          </p>
        </div>
      )}

      {/* Subject + topic (practice) */}
      {value.track === 'practice' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Syllabus Subject <span className="text-red-500">*</span></Label>
            <Select
              value={value.subject_id ?? undefined}
              onValueChange={v => onChange({ ...value, subject_id: v, topic_id: null })}
              disabled={!stage}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder={stage ? 'Select subject…' : 'Pick a stage first'} />
              </SelectTrigger>
              <SelectContent>
                {(stage?.subjects ?? []).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Topic <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Select
              value={value.topic_id ?? undefined}
              onValueChange={v => onChange({ ...value, topic_id: v })}
              disabled={!subject}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder={subject ? 'Whole subject' : 'Pick a subject first'} />
              </SelectTrigger>
              <SelectContent>
                {(subject?.topics ?? []).map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Feedback */}
      {errors.length > 0 && (
        <ul className="space-y-1">
          {errors.map(e => (
            <li key={e} className="flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" /> {e}
            </li>
          ))}
        </ul>
      )}
      {warnings.map(w => (
        <p key={w} className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <Info className="h-3.5 w-3.5 shrink-0 mt-px" /> {w}
        </p>
      ))}
    </div>
  );
}

function TrackCard({
  active,
  onClick,
  title,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-2.5 text-left transition-all',
        active
          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-300 dark:ring-indigo-700'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
      )}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span className="mt-0.5 block text-[11px] text-muted-foreground">{detail}</span>
    </button>
  );
}
