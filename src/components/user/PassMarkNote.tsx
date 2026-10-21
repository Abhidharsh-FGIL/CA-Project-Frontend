import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { levelFromTitle, levelKey, passMarkFor, passMarks, standingOf, type PassStanding } from '@/config/pass-marks';
import { difficultyLabel } from '@/lib/eval-difficulty';
import type { AttemptReportModel } from '@/lib/attempt-report';
import { usePassMarks } from '@/hooks/use-pass-marks';

const TONE: Record<PassStanding, string> = {
  target: 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
  pass: 'border-emerald-200 bg-emerald-50/50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100',
  close: 'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
  below: 'border-rose-200 bg-rose-50/60 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
};

/**
 * Where this score sits against the MyGovExams benchmark for the paper — its pass mark and the mark to aim for.
 * These are learning benchmarks, not TNPSC's cut-offs, and the note says so.
 */
export function PassMarkNote({ model, track }: { model: AttemptReportModel; track: string | null }) {
  usePassMarks(); // draws again once the server's benchmarks arrive
  const s = model.summary;
  const isMock = track === 'mock';
  const level = isMock ? undefined : levelFromTitle(model.meta.testName);
  const mark = passMarkFor({ kind: isMock ? 'mock' : 'practice', level });
  const standing = standingOf(s.percentage, mark);
  if (standing == null) return null;

  const marks = passMarks(mark, s.maxMarks);
  const what = isMock ? 'full-length mock' : `${difficultyLabel(levelKey(level))} practice`;
  const pct = Math.round((s.percentage ?? 0) * 10) / 10;
  const gap = marks && s.score != null ? Math.max(0, marks.pass - s.score) : null;

  const line =
    standing === 'target'
      ? `You are at or above the ${mark.target}% target.`
      : standing === 'pass'
        ? `Above the pass mark. ${mark.target}% is the target.`
        : gap != null && gap > 0
          ? `${gap} more mark${gap === 1 ? '' : 's'} to reach the pass mark.`
          : `Below the ${mark.pass}% pass mark.`;

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', TONE[standing])}>
      <Target className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
      <div className="min-w-0 text-xs leading-relaxed">
        <p className="font-bold">
          {pct}% · {what} · pass mark {mark.pass}%{marks ? ` (${marks.pass}/${s.maxMarks})` : ''} · aim {mark.target}%
          {marks ? ` (${marks.target}/${s.maxMarks})` : ''}
        </p>
        <p className="opacity-90">{line}</p>
        <p className="mt-0.5 text-[11px] opacity-70">MyGovExams learning benchmark — not an official TNPSC pass mark.</p>
      </div>
    </div>
  );
}
