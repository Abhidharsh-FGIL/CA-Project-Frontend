import { useEffect, useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Clock, FileText, Gift, Loader2 } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { Countdown, useNow } from '@/components/promotional/Countdown';
import { ExpiredNotice } from '@/pages/PromotionalLinkPage';
import { clearReturnTo, clockOffset, getMyPromotional, promotionalPhase, whenLabel, type PromotionalAssessment } from '@/lib/promotionalApi';

/** What the test page is told when a promotional test is opened from here: start at once, and come back here after. */
export interface PromotionalLaunchState {
  promotional: true;
  autostart: true;
  from: string;
}

export const promotionalTestPath = (id: string) => `/user/promotional/${encodeURIComponent(id)}`;
export const promotionalResultPath = (id: string) => `/user/promotional/${encodeURIComponent(id)}/result`;

/**
 * A promotional test for a signed-in student (`/user/promotional/:id`).
 *
 * Before it opens: a countdown, and the test starts on its own when it reaches zero. While open: straight into the
 * test. Already taken: their result. After it closes: expired, and off to the landing page.
 */
export default function PromotionalTestPage() {
  const { id = '' } = useParams<{ id: string }>();
  // The link that brought them here has done its job.
  useEffect(() => clearReturnTo(), []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['promotional', 'mine', id],
    queryFn: () => getMyPromotional(id),
    enabled: !!id,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }
  if (isError || !data) return <ExpiredNotice />;
  return <Gate promo={data} />;
}

function Gate({ promo }: { promo: PromotionalAssessment }) {
  const navigate = useNavigate();
  const offset = useMemo(() => clockOffset(promo.server_time), [promo.server_time]);
  const now = useNow(offset);
  const phase = promotionalPhase(promo, now);
  const taken = !!promo.attempted && !promo.in_progress_attempt_id;
  const goLive = phase === 'live' && !taken;

  useEffect(() => {
    if (!goLive) return;
    const state: PromotionalLaunchState = { promotional: true, autostart: true, from: promotionalTestPath(promo.id) };
    navigate(`/user/assessment/${encodeURIComponent(promo.id)}`, { replace: true, state });
  }, [goLive, navigate, promo.id]);

  if (taken) return <Navigate to={promotionalResultPath(promo.id)} replace />;
  if (phase === 'ended') return <ExpiredNotice title={promo.title} />;
  if (goLive) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const minutes = promo.time_limit_seconds ? Math.round(promo.time_limit_seconds / 60) : null;
  return (
    <UserShell>
      <div className="mx-auto max-w-2xl">
        <div className="overflow-hidden rounded-3xl bg-white shadow-lg dark:bg-slate-900">
          <div className="bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 p-6 text-center text-white sm:p-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
              <Gift className="h-3.5 w-3.5" /> Free test · get ready
            </span>
            <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">{promo.title}</h1>
            {promo.description && <p className="mx-auto mt-2 max-w-md text-sm opacity-90">{promo.description}</p>}
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-widest opacity-90">Starts in</p>
            <Countdown to={promo.starts_at} now={now} tone="dark" />
          </div>
          <div className="space-y-4 p-6 sm:p-8">
            <ul className="grid grid-cols-1 gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
              <li className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-orange-500" /> {whenLabel(promo.starts_at)}</li>
              {promo.question_count ? <li className="flex items-center gap-2"><FileText className="h-4 w-4 text-orange-500" /> {promo.question_count} questions</li> : null}
              {minutes ? <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-orange-500" /> {minutes} minutes</li> : null}
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Keep this page open — the test starts by itself at {whenLabel(promo.starts_at)}. It is free and does not use any of
              your plan&apos;s tests. It closes at {whenLabel(promo.ends_at)}.
            </p>
          </div>
        </div>
      </div>
    </UserShell>
  );
}
