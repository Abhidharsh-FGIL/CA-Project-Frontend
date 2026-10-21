import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CalendarClock, ClipboardList, Crown, Timer, Wallet } from 'lucide-react';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { getPlan } from '@/data/userPortalSampleData';
import { billingCycleOf, planAllowance } from '@/lib/plan-allowance';
import { useCurrentPlanPurchase } from '@/hooks/use-plan-purchase';
import { planCounts } from '@/lib/plans';
import { getPurchaseHistory } from '@/lib/purchase-history';
import { getCurrentSubscription } from '@/lib/subscriptionApi';
import { cn } from '@/lib/utils';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The plan the person is on, what it includes, how much of it they have used and what is left, and how long
 * it runs. Tests used are counted from their attempts since the plan began, as on the test start screen; the
 * server enforces the real limit.
 */
export function CurrentPlanCard() {
  const { user, history } = useUserPortal();
  const planPurchase = useCurrentPlanPurchase();

  const { data: sub } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: getCurrentSubscription,
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });
  // Top-up credits are bought on top of the plan and do not expire.
  const { data: topups } = useQuery({
    queryKey: ['purchase-history', 'topup-credits'],
    queryFn: () => getPurchaseHistory({ kind: 'topup', limit: 100 }),
    staleTime: 5 * 60 * 1000,
    enabled: !!user && user.subscription_tier !== 'free',
  });

  if (!user) return null;

  const plan = getPlan(user.subscription_tier);
  const isFree = user.subscription_tier === 'free';
  const active = sub?.status === 'active' ? sub : null;
  const cycle = active ? (active.billing_cycle ?? billingCycleOf(active.start_date, active.end_date)) : null;
  const limits = planCounts(plan, cycle ?? 'monthly');
  const since = active?.start_date ?? null;
  const mock = planAllowance(plan, 'mock', history, since, undefined, planPurchase);
  const practice = planAllowance(plan, 'practice', history, since, undefined, planPurchase);

  const credits = (topups?.items ?? [])
    .filter(p => p.validity && p.validity.status === 'active')
    .reduce(
      (t, p) => ({
        mock: t.mock + Math.max(0, (p.validity!.mock_tests ?? 0) - (p.validity!.mock_used ?? 0)),
        practice: t.practice + Math.max(0, (p.validity!.practice_tests ?? 0) - (p.validity!.practice_used ?? 0)),
      }),
      { mock: 0, practice: 0 },
    );

  // Time: how far through the plan, and the days that remain.
  const start = active ? +new Date(active.start_date) : null;
  const end = active ? +new Date(`${active.end_date.slice(0, 10)}T23:59:59`) : null;
  const daysLeft = end != null ? Math.max(0, Math.ceil((end - Date.now()) / 86_400_000)) : null;
  const elapsedPct =
    start != null && end != null ? Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100)) : 0;

  return (
    <section className="mb-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">Current plan</p>
          <h2 className="mt-0.5 flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            {user.subscription_tier === 'premium' && <Crown className="w-5 h-5 text-amber-500" />}
            {plan.name}
            {cycle && (
              <span className="rounded-full bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                {cycle === 'yearly' ? 'Yearly' : 'Monthly'}
              </span>
            )}
          </h2>
        </div>
        <Link
          to="/user/subscription"
          className="rounded-xl bg-gray-900 dark:bg-gray-100 px-3.5 py-2 text-xs font-bold text-white dark:text-gray-900 hover:opacity-90"
        >
          {isFree ? 'Upgrade' : 'Change plan'}
        </Link>
      </div>

      {/* Validity */}
      <div className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 p-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
          <CalendarClock className="w-4 h-4 text-blue-500" />
          {isFree ? (
            <span>Validity: unlimited — your free tests never expire</span>
          ) : active ? (
            <span>
              {day(active.start_date)} – {day(active.end_date)}
              <span className="ml-2 font-bold text-gray-900 dark:text-gray-100">
                {daysLeft === 0 ? 'Ends today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
              </span>
            </span>
          ) : (
            <span>Validity not available</span>
          )}
        </div>
        {active && (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={cn('h-full rounded-full', (daysLeft ?? 99) <= 5 ? 'bg-rose-500' : 'bg-blue-500')}
              style={{ width: `${elapsedPct}%` }}
            />
          </div>
        )}
      </div>

      {/* Tests: included, taken, left */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Usage
          icon={<Timer className="w-4 h-4" />}
          label="Mock tests"
          limit={limits.mock}
          used={mock.used}
          credits={credits.mock}
        />
        <Usage
          icon={<ClipboardList className="w-4 h-4" />}
          label="Practice tests"
          limit={limits.practice}
          used={practice.used}
          credits={credits.practice}
        />
      </div>
    </section>
  );
}

function Usage({
  icon,
  label,
  limit,
  used,
  credits,
}: {
  icon: React.ReactNode;
  label: string;
  /** What the plan includes; null for unlimited. */
  limit: number | null;
  used: number;
  /** Top-up tests still unused, on top of the plan. */
  credits: number;
}) {
  const left = limit == null ? null : Math.max(0, limit - used);
  const pct = limit && limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-200">
        <span className="text-blue-500">{icon}</span>
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold leading-none text-gray-900 dark:text-gray-100">{used}</p>
          <p className="mt-1 text-[10px] text-gray-500">taken</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold leading-none text-emerald-600 dark:text-emerald-400">
            {left == null ? '∞' : left}
          </p>
          <p className="mt-1 text-[10px] text-gray-500">{left == null ? 'unlimited' : 'remaining'}</p>
        </div>
      </div>
      {limit != null && (
        <>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[10px] text-gray-500">Plan includes {limit}</p>
        </>
      )}
      {credits > 0 && (
        <div className="mt-2.5 flex items-center justify-between gap-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 px-2.5 py-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
            <Wallet className="w-3.5 h-3.5" /> Top-up balance
          </span>
          <span className="text-[11px] font-bold text-violet-700 dark:text-violet-300">
            {credits} test{credits === 1 ? '' : 's'} saved
          </span>
        </div>
      )}
    </div>
  );
}
