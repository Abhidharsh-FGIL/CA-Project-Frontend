import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserShell } from '@/components/user/UserShell';
import { getMyLeaderboard, getMyPromotional } from '@/lib/promotionalApi';

/**
 * Where a promotional test leads after it is submitted (`/user/promotional/:id/result`).
 *
 * The student's own score and a link to their report. There is no ranking or leaderboard on the student side: the
 * score is read from the same endpoint that carries the board, and the board itself is not shown.
 */
export default function PromotionalResultPage() {
  const { id = '' } = useParams<{ id: string }>();

  const promoQ = useQuery({ queryKey: ['promotional', 'mine', id], queryFn: () => getMyPromotional(id), enabled: !!id });
  const boardQ = useQuery({ queryKey: ['promotional', 'board', id], queryFn: () => getMyLeaderboard(id), enabled: !!id, staleTime: 0 });

  const promo = promoQ.data;
  const board = boardQ.data;

  if (promoQ.isLoading || boardQ.isLoading) {
    return (
      <UserShell>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      </UserShell>
    );
  }

  const me = board?.me ?? null;
  const reportId = me?.attempt_id || promo?.attempt_id || null;

  return (
    <UserShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 p-6 text-white shadow-lg sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-widest opacity-90">Free test · results</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{promo?.title ?? board?.title ?? 'Promotional test'}</h1>

          {me ? (
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 flex-col items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-bold">Submitted</span>
              </div>
              <div>
                <p className="text-lg font-bold">Your score</p>
                <p className="text-2xl font-extrabold tabular-nums">
                  {me.score}
                  {me.max_score ? <span className="text-base font-semibold opacity-90"> / {me.max_score}</span> : null}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm opacity-90">{board ? 'You did not take this test.' : 'Your test has been submitted.'}</p>
          )}
        </div>

        {boardQ.isError && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Your score could not be loaded just now. Try again in a moment.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {reportId && (
            <Button asChild>
              <Link to={`/user/report/${encodeURIComponent(reportId)}`}>View my report</Link>
            </Button>
          )}
          <Button asChild variant="outline">
            <Link to="/user/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </UserShell>
  );
}
