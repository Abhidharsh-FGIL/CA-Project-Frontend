/**
 * Shared presentation pieces for the study plan.
 *
 * Formatting only. Nothing here derives a figure the server did not send — the
 * closest it comes is turning 195 minutes into "3h 15m" and an ISO date into
 * "Mon 5 Oct", which is display, not planning.
 */
import { format, parseISO } from 'date-fns';
import {
  BookOpen,
  CalendarOff,
  ClipboardCheck,
  FileText,
  PencilLine,
  RotateCcw,
  Stethoscope,
  Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACCENT, type Accent } from '@/components/user/report-ui';
import type { DayStatus, TaskKind, Verdict } from '@/lib/studyPlanApi';

// ─── Formatters ───────────────────────────────────────────────────────────────

/** 195 → "3h 15m", 45 → "45m", 120 → "2h". */
export function fmtMinutes(m: number | null | undefined): string {
  if (m == null) return '—';
  if (m === 0) return '0m';
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  if (rem === 0) return `${h}h`;
  return `${h}h ${rem}m`;
}

/** Hours only, for headline tiles where "28,080m" is unreadable. */
export function fmtHours(m: number | null | undefined): string {
  if (m == null) return '—';
  return `${Math.round(m / 60).toLocaleString()} hrs`;
}

export function fmtDate(iso: string | null | undefined, pattern = 'd MMM yyyy'): string {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), pattern);
  } catch {
    return iso;
  }
}

export function fmtDayLabel(iso: string): string {
  return fmtDate(iso, 'EEE d MMM');
}

export function fmtRange(from: string, to: string): string {
  return `${fmtDate(from, 'd MMM')} – ${fmtDate(to, 'd MMM')}`;
}

export const todayISO = (): string => format(new Date(), 'yyyy-MM-dd');

// ─── Task kinds ───────────────────────────────────────────────────────────────

/**
 * How each kind of work presents itself.
 *
 * A candidate scanning a day should be able to tell a concept session from a
 * timed mock without reading the title, so kind carries both an icon and a hue.
 */
export const TASK_KIND: Record<
  TaskKind,
  { label: string; accent: Accent; icon: typeof BookOpen }
> = {
  concept: { label: 'Concept', accent: 'indigo', icon: BookOpen },
  notes: { label: 'Notes', accent: 'sky', icon: PencilLine },
  practice: { label: 'Practice', accent: 'emerald', icon: ClipboardCheck },
  review: { label: 'Review', accent: 'amber', icon: FileText },
  revision: { label: 'Revision', accent: 'violet', icon: RotateCcw },
  mock: { label: 'Mock test', accent: 'rose', icon: Timer },
  diagnostic: { label: 'Diagnostic', accent: 'slate', icon: Stethoscope },
};

export function TaskKindChip({ kind }: { kind: TaskKind }) {
  const meta = TASK_KIND[kind] ?? TASK_KIND.practice;
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
        ACCENT[meta.accent].chip,
      )}
    >
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

// ─── Day status ───────────────────────────────────────────────────────────────

export const DAY_STATUS: Record<DayStatus, { label: string; accent: Accent }> = {
  pending: { label: 'Pending', accent: 'slate' },
  done: { label: 'Done', accent: 'emerald' },
  partial: { label: 'Partly done', accent: 'amber' },
  skipped: { label: 'Missed', accent: 'rose' },
};

// ─── Feasibility ──────────────────────────────────────────────────────────────

export const VERDICT: Record<Verdict, { label: string; accent: Accent; blurb: string }> = {
  comfortable: {
    label: 'Comfortable',
    accent: 'emerald',
    blurb: 'This fits the syllabus with room for revision.',
  },
  tight: {
    label: 'Tight',
    accent: 'amber',
    blurb: 'This covers the syllabus once, with little slack.',
  },
  not_feasible: {
    label: "Won't fit",
    accent: 'rose',
    blurb: 'There is not enough time here to cover the syllabus.',
  },
};

export function VerdictPill({ verdict }: { verdict: Verdict }) {
  const v = VERDICT[verdict];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
        ACCENT[v.accent].chip,
      )}
    >
      {v.label}
    </span>
  );
}

// ─── Shared empty / absent states ─────────────────────────────────────────────

/**
 * The backend has not shipped study plans yet.
 *
 * Shown in place of every plan screen when a call 404s or 501s. Deliberately a
 * plain statement rather than an error: the frontend ships ahead of the
 * endpoints by design (STUDY_PLAN_BACKEND_CHANGES.md §S10), and an aspirant who
 * finds this page early should see an explanation, not a stack trace.
 */
export function StudyPlanUnavailable({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 text-center',
        compact ? 'p-5' : 'p-10',
      )}
    >
      <span className="inline-flex w-10 h-10 rounded-full items-center justify-center bg-gray-100 dark:bg-gray-800 mb-3">
        <CalendarOff className="w-5 h-5 text-gray-400" />
      </span>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        Study plans are not enabled on this account yet
      </p>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
        Your plan is built on our servers from your syllabus and your mock-test results. The
        feature is on its way — nothing is wrong with your account.
      </p>
    </div>
  );
}

/** A small progress ring for coverage and adherence meters. */
export function MiniRing({
  pct,
  size = 56,
  accent = 'indigo',
  label,
}: {
  pct: number;
  size?: number;
  accent?: Accent;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-gray-100 dark:stroke-gray-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={ACCENT[accent].hex}
          strokeDasharray={circ}
          strokeDashoffset={circ - (circ * clamped) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-xs font-bold leading-none', ACCENT[accent].text)}>
          {Math.round(clamped)}%
        </span>
        {label && <span className="text-[8px] text-gray-400 mt-0.5">{label}</span>}
      </div>
    </div>
  );
}
