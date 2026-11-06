import { Crown, Medal } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LeaderboardRow } from '@/lib/promotionalApi';

const pct = (r: LeaderboardRow): number | null => {
  if (r.percentage != null) return Math.round(r.percentage);
  return r.max_score ? Math.round((r.score / r.max_score) * 100) : null;
};

export function duration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-500" aria-label="Rank 1" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400" aria-label="Rank 2" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-orange-600" aria-label="Rank 3" />;
  return <span className="font-bold tabular-nums text-slate-600 dark:text-slate-300">{rank}</span>;
}

/**
 * Ranked rows, best first. `meId` highlights the student's own row; when that row is not among `rows` (outside the
 * top 50), it is added below a gap so they still see where they stand. `extra` adds admin columns.
 */
export function LeaderboardTable({
  rows: given,
  me,
  meId,
  admin,
  onOpen,
}: {
  rows?: LeaderboardRow[] | null;
  me?: LeaderboardRow | null;
  meId?: string | null;
  admin?: boolean;
  onOpen?: (row: LeaderboardRow) => void;
}) {
  const rows = given ?? [];
  const mine = (r: LeaderboardRow) => !!meId && r.user_id === meId;
  const meOutside = !!me && !rows.some(r => r.user_id === me.user_id);

  const row = (r: LeaderboardRow) => (
    <tr
      key={`${r.rank}-${r.user_id}`}
      className={cn(
        'border-t border-slate-100 dark:border-slate-800',
        mine(r) && 'bg-amber-50 font-semibold ring-2 ring-inset ring-amber-400 dark:bg-amber-950/40',
      )}
    >
      <td className="w-14 px-3 py-2.5 text-center">
        <span className="inline-flex justify-center">
          <RankBadge rank={r.rank} />
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="text-slate-900 dark:text-slate-100">{r.name || 'Student'}</span>
        {mine(r) && <span className="ml-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">You</span>}
        {admin && (r.email || r.phone) && (
          <span className="block text-xs font-normal text-slate-500">{[r.email, r.phone].filter(Boolean).join(' · ')}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {r.score}
        {r.max_score ? <span className="text-slate-400">/{r.max_score}</span> : null}
      </td>
      <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell">{pct(r) == null ? '—' : `${pct(r)}%`}</td>
      <td className="hidden px-3 py-2.5 text-right tabular-nums text-slate-500 sm:table-cell">{duration(r.time_taken_seconds)}</td>
      {admin && (
        <td className="px-3 py-2.5 text-right">
          {r.attempt_id && onOpen ? (
            <button type="button" onClick={() => onOpen(r)} className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400">
              Report
            </button>
          ) : null}
        </td>
      )}
    </tr>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-3 py-2 text-center">Rank</th>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-right">Score</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell">%</th>
            <th className="hidden px-3 py-2 text-right sm:table-cell">Time</th>
            {admin && <th className="px-3 py-2 text-right">Report</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(row)}
          {meOutside && (
            <>
              <tr>
                <td colSpan={admin ? 6 : 5} className="py-1 text-center text-slate-400">⋯</td>
              </tr>
              {row(me!)}
            </>
          )}
          {rows.length === 0 && !meOutside && (
            <tr>
              <td colSpan={admin ? 6 : 5} className="px-3 py-8 text-center text-slate-500">
                No one has taken it yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
