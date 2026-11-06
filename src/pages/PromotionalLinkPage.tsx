import { useEffect, useMemo } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Clock, FileText, Gift, Loader2, TimerOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getUserToken } from '@/lib/api';
import {
  clockOffset,
  getPublicPromotional,
  promotionalPhase,
  setReturnTo,
  whenLabel,
  type PromotionalAssessment,
} from '@/lib/promotionalApi';
import { Countdown, useNow } from '@/components/promotional/Countdown';

/** Seconds an expired link waits before sending the visitor to the landing page. */
export const EXPIRED_REDIRECT_SECONDS = 5;

/**
 * Where a promotional test's share link lands (`#/promotional/:id`).
 *
 * A signed-in student goes straight on to the test. Anyone else sees what the test is and when it opens, with a
 * countdown, and signs in or signs up — after which they are taken to it (`setReturnTo`). An ended test says so and
 * goes to the landing page.
 */
export default function PromotionalLinkPage() {
  const { id = '' } = useParams<{ id: string }>();
  const signedIn = !!getUserToken();
  const target = `/user/promotional/${encodeURIComponent(id)}`;

  // Remembered from the first moment, so whichever way they sign in or up, they come back to it.
  useEffect(() => {
    if (id) setReturnTo(target);
  }, [id, target]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['promotional', 'public', id],
    queryFn: () => getPublicPromotional(id),
    enabled: !!id && !signedIn,
    retry: 1,
  });

  if (signedIn) return <Navigate to={target} replace />;
  if (isLoading) return <Screen><Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-500" /></Screen>;
  if (isError || !data) return <InvalidLink />;
  return <LinkBody promo={data} />;
}

function LinkBody({ promo }: { promo: PromotionalAssessment }) {
  const offset = useMemo(() => clockOffset(promo.server_time), [promo.server_time]);
  const now = useNow(offset);
  const phase = promotionalPhase(promo, now);

  if (phase === 'ended') return <ExpiredNotice title={promo.title} />;

  const minutes = promo.time_limit_seconds ? Math.round(promo.time_limit_seconds / 60) : null;
  return (
    <Screen>
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl dark:bg-slate-900">
        <div className="bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 p-6 text-center text-white sm:p-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
            <Gift className="h-3.5 w-3.5" /> Free test
          </span>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">{promo.title}</h1>
          {promo.description && <p className="mx-auto mt-2 max-w-md text-sm opacity-90">{promo.description}</p>}
          <div className="mt-5">
            {phase === 'upcoming' ? (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-90">Starts in</p>
                <Countdown to={promo.starts_at} now={now} tone="dark" />
              </>
            ) : (
              <>
                <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> Live now · closes in
                </p>
                <Countdown to={promo.ends_at} now={now} tone="dark" />
              </>
            )}
          </div>
        </div>

        <div className="space-y-5 p-6 sm:p-8">
          <ul className="grid grid-cols-1 gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
            <li className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-orange-500" /> {whenLabel(promo.starts_at)}</li>
            {promo.question_count ? <li className="flex items-center gap-2"><FileText className="h-4 w-4 text-orange-500" /> {promo.question_count} questions</li> : null}
            {minutes ? <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-orange-500" /> {minutes} minutes</li> : null}
          </ul>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Sign in or create a free account. You will be taken straight to the test
            {phase === 'upcoming' ? ' — it starts on its own when the countdown ends' : ''}. You will see your score as soon as you submit.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild size="lg" className="bg-orange-600 hover:bg-orange-700">
              <Link to="/user/login">I have an account — Log in</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/user/register">New here? Sign up free</Link>
            </Button>
          </div>
        </div>
      </div>
    </Screen>
  );
}

/** "This test has ended", then the landing page. Shared with the signed-in page. */
export function ExpiredNotice({ title, home = '/' }: { title?: string; home?: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => navigate(home, { replace: true }), EXPIRED_REDIRECT_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [navigate, home]);
  return (
    <Screen>
      <div className="rounded-3xl bg-white p-8 text-center shadow-xl dark:bg-slate-900">
        <TimerOff className="mx-auto h-12 w-12 text-rose-500" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">This test has expired</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {title ? <>“{title}” is closed.</> : 'This test is closed.'} Taking you to the home page…
        </p>
        <Button className="mt-6" onClick={() => navigate(home, { replace: true })}>
          Go now
        </Button>
      </div>
    </Screen>
  );
}

function InvalidLink() {
  return (
    <Screen>
      <div className="rounded-3xl bg-white p-8 text-center shadow-xl dark:bg-slate-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">This test link is not valid</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Check the link you were sent, or explore the free tests on MyGovExams.</p>
        <Button asChild className="mt-6">
          <Link to="/">Go to home</Link>
        </Button>
      </div>
    </Screen>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-rose-100 px-4 py-8 dark:from-slate-950 dark:via-slate-950 dark:to-rose-950/40">
      <div className="w-full max-w-xl">{children}</div>
    </div>
  );
}
