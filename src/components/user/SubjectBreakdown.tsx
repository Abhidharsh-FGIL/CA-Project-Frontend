/**
 * Per-subject accuracy as ranked bars.
 *
 * Bars rather than more ring slices: a categorical palette stops being
 * colour-blind-safe past about seven hues (the dataviz validator fails a 14-hue set
 * at deutan ΔE 5.3), and there are 13+ subjects in the syllabus. Length encodes the
 * value, so the list stays readable at any number of subjects.
 *
 * `composition` additionally splits each bar into correct / wrong / unanswered, which
 * is what explains a low score: blanks, not wrong answers, are usually the gap.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SubjectStrength } from '@/lib/userDashboardApi';

/** Status colours — reserved for state, never reused as series colours. */
const CORRECT = '#10b981';
const WRONG = '#f43f5e';

export type SubjectSort = 'weakest' | 'strongest' | 'most-answered';

interface Props {
  subjects: SubjectStrength[];
  /** Split each bar into correct / wrong / unanswered instead of plain accuracy. */
  composition?: boolean;
  sort?: SubjectSort;
  /** Rows to render before "show all"; omit to render everything. */
  limit?: number;
  className?: string;
}

export function sortSubjects(list: SubjectStrength[], sort: SubjectSort): SubjectStrength[] {
  const copy = [...list];
  if (sort === 'most-answered') return copy.sort((x, y) => (y.attempted ?? 0) - (x.attempted ?? 0));
  copy.sort((x, y) => x.accuracy - y.accuracy);
  return sort === 'weakest' ? copy : copy.reverse();
}

export function SubjectBreakdown({
  subjects,
  composition = false,
  sort = 'weakest',
  limit,
  className,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const ordered = useMemo(() => sortSubjects(subjects, sort), [subjects, sort]);
  const rows = limit && !expanded ? ordered.slice(0, limit) : ordered;
  const hidden = ordered.length - rows.length;

  if (ordered.length === 0) return null;

  return (
    <div className={className}>
      {composition && (
        // Status colour never carries meaning alone — the key names each state.
        <div className="flex items-center gap-3 mb-2.5 text-[10px] text-gray-500 dark:text-gray-400">
          <Key color={CORRECT} label="Correct" />
          <Key color={WRONG} label="Wrong" />
          <Key className="bg-gray-200 dark:bg-gray-700" label="Not answered" />
        </div>
      )}

      <ul className="space-y-2.5">
        {rows.map(s => {
          const attempted = s.attempted ?? 0;
          const correct = s.correct ?? 0;
          const wrong = Math.max(0, attempted - correct);
          const total = s.total_questions ?? attempted;
          const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

          return (
            <li key={s.subject}>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-[11px] text-gray-700 dark:text-gray-200 truncate flex-1 min-w-0">
                  {s.subject}
                </span>
                <span className="text-[11px] font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                  {Math.round(s.accuracy)}%
                </span>
              </div>

              {composition ? (
                <>
                  {/* 2px gaps between segments keep adjacent fills readable. */}
                  <div className="flex items-center gap-[2px] h-2">
                    <Seg width={pct(correct)} color={CORRECT} />
                    <Seg width={pct(wrong)} color={WRONG} />
                    <div className="h-full flex-1 rounded-r bg-gray-100 dark:bg-gray-800" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {correct} correct · {wrong} wrong · {Math.max(0, total - attempted)} not answered
                  </p>
                </>
              ) : (
                <div className="h-2 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded bg-indigo-500 dark:bg-indigo-400"
                    style={{ width: `${Math.max(2, Math.min(100, s.accuracy))}%` }}
                    title={`${correct} of ${attempted} answered correctly`}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {limit != null && (hidden > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-3 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {expanded ? 'Show fewer' : `Show all ${ordered.length} subjects`}
        </button>
      )}
    </div>
  );
}

function Seg({ width, color }: { width: number; color: string }) {
  if (width <= 0) return null;
  return <div className="h-full rounded" style={{ width: `${width}%`, background: color, minWidth: 2 }} />;
}

function Key({ color, label, className }: { color?: string; label: string; className?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-sm', className)} style={color ? { background: color } : undefined} />
      {label}
    </span>
  );
}
