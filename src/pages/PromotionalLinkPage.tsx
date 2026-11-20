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
import { useT } from '@/content/useText';

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
  const t = useT();
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
            <Gift className="h-3.5 w-3.5" /> {t('assessment.promo.link.badge')}
          </span>
          <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">{promo.title}</h1>
          {promo.description && <p className="mx-auto mt-2 max-w-md text-sm opacity-90">{promo.description}</p>}
          <div className="mt-5">
            {phase === 'upcoming' ? (
              <>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest opacity-90">{t('assessment.promo.countdown.starts_in')}</p>
                <Countdown to={promo.starts_at} now={now} tone="dark" />
              </>
            ) : (
              <>
                <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> {t('assessment.promo.link.live')}
                </p>
                <Countdown to={promo.ends_at} now={now} tone="dark" />
              </>
            )}
          </div>
        </div>

        <div className="space-y-5 p-6 sm:p-8">
          <ul className="grid grid-cols-1 gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-3">
            <li className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-orange-500" /> {whenLabel(promo.starts_at)}</li>
            {promo.question_count ? <li className="flex items-center gap-2"><FileText className="h-4 w-4 text-orange-500" /> {t('assessment.promo.meta.questions', { count: promo.question_count })}</li> : null}
            {minutes ? <li className="flex items-center gap-2"><Clock className="h-4 w-4 text-orange-500" /> {t('assessment.promo.meta.minutes', { minutes })}</li> : null}
          </ul>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {phase === 'upcoming' ? t('assessment.promo.link.intro.upcoming') : t('assessment.promo.link.intro.live')}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild size="lg" className="bg-orange-600 hover:bg-orange-700">
              <Link to="/user/login">{t('assessment.promo.link.login')}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/user/register">{t('assessment.promo.link.register')}</Link>
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
  const t = useT();
  useEffect(() => {
    const timer = setTimeout(() => navigate(home, { replace: true }), EXPIRED_REDIRECT_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [navigate, home]);
  return (
    <Screen>
      <div className="rounded-3xl bg-white p-8 text-center shadow-xl dark:bg-slate-900">
        <TimerOff className="mx-auto h-12 w-12 text-rose-500" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">{t('assessment.promo.expired.heading')}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {title ? t('assessment.promo.expired.named', { title }) : t('assessment.promo.expired.plain')}
        </p>
        <Button className="mt-6" onClick={() => navigate(home, { replace: true })}>
          Go now
        </Button>
      </div>
    </Screen>
  );
}

function InvalidLink() {
  const t = useT();
  return (
    <Screen>
      <div className="rounded-3xl bg-white p-8 text-center shadow-xl dark:bg-slate-900">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{t('assessment.promo.invalid.heading')}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('assessment.promo.invalid.body')}</p>
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
