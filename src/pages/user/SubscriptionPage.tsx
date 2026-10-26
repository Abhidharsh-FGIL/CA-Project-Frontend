import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import {
  Check,
  Crown,
  Gem,
  Gift,
  Sparkles,
  X,
  Tag,
  CheckCircle2,
  CreditCard,
  Loader2,
  BadgePercent,
  IndianRupee,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  getEffectivePlanPrice,
  getSubscriptionPlanPrice,
  type SubscriptionTier,
  type SubscriptionPlanInfo,
  type SubscriptionPromoCode,
  getPlan,
} from '@/data/userPortalSampleData';
import { costPerMonth, perksFor, validityOf } from '@/lib/plans';
import { cardFor, cycleShown } from '@/lib/plan-copy';
import { getCurrentSubscription, validatePromo, type CurrentSubscription, type PromoValidation } from '@/lib/subscriptionApi';
import { GST_LABEL, breakdownFrom, isGstInclusive } from '@/lib/gst';
import { createTopUpOrder, getTopUpBalance, getTopUpPacks, validateTopUpPromo, verifyTopUp, type TopUpPack, type TopUpPromoQuote } from '@/lib/topup-api';
import { purchaseTopUp } from '@/lib/topup-purchase';
import { openCheckout } from '@/lib/razorpay';
import type { ApiAttempt, ApiEvalAssessment } from '@/lib/userPortalApi';
import { billingCycleOf, planAllowance, planCardState } from '@/lib/plan-allowance';
import type { PurchaseOutcome } from '@/lib/purchase';

type Billing = 'monthly' | 'yearly';

/**
 * The Plans page, as designed: the current plan at the top, one card per plan and billing cycle, and the
 * top-up packs with a pay bar. Every figure is the backend's — the plans from `/user/subscription/plans`,
 * the packs and balances from `/user/topup/*`, the end date from `/user/subscription/current`.
 */
export default function SubscriptionPage() {
  const { user, plans, history, assessments, upgradeSubscription, payForSubscription } = useUserPortal();
  const [checkout, setCheckout] = useState<{ plan: SubscriptionPlanInfo; billing: Billing } | null>(null);

  // Whether the plan they hold was bought for a month or a year. The subscription record has no cycle of its
  // own, so the server's stored cycle is used and the length of the subscription is the fallback.
  const { data: sub } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: getCurrentSubscription,
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });
  const heldCycle: Billing | null =
    sub?.status === 'active' ? (sub.billing_cycle ?? billingCycleOf(sub.start_date, sub.end_date)) : null;

  if (!user) return null;

  const free = plans.filter(p => p.price_monthly === 0);
  const paid = plans.filter(p => p.price_monthly > 0);
  // Free first, then each paid plan's monthly and yearly card. A plan with no yearly price has only monthly.
  const cards: Array<{ plan: SubscriptionPlanInfo; billing: Billing }> = [
    ...free.map(plan => ({ plan, billing: 'monthly' as Billing })),
    ...paid.flatMap(plan => [
      { plan, billing: 'monthly' as Billing },
      ...(plan.price_yearly > 0 ? [{ plan, billing: 'yearly' as Billing }] : []),
    ]),
  ];

  return (
    <UserShell>
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between animate-fadeIn">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-gray-100">
            Choose your <span className="text-orange-600 dark:text-orange-400">plan</span>
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Start free. Upgrade when you want more tests and detailed reports.
          </p>
        </div>
      </div>

      {/* A retired plan is not on the page, so say where its holder stands. */}
      {getPlan(user.subscription_tier)?.legacy && (
        <div className="mb-5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          You are on <b>{getPlan(user.subscription_tier).name}</b>, which is no longer sold. It stays active, with
          everything it includes, until it expires — after that you can choose any of the plans below.
        </div>
      )}

      <div className={cn('grid gap-4 md:grid-cols-2', cards.length >= 3 && 'xl:grid-cols-3')}>
        {cards.map(({ plan, billing }) => (
          <OptionCard
            key={`${plan.tier}-${billing}`}
            plan={plan}
            billing={billing}
            userTier={user.subscription_tier}
            heldCycle={heldCycle}
            bestValue={billing === 'yearly' && isBestValue(plan)}
            onChoose={() => {
              if (plan.tier === 'free') {
                // Direct downgrade — no payment / no promo needed.
                handleDirectChange(plan.tier, upgradeSubscription);
                return;
              }
              setCheckout({ plan, billing });
            }}
          />
        ))}
      </div>

      <TopUpSection customer={{ name: user.name, email: user.email, contact: user.phone }} />

      {/* Promo hint strip */}
      <div className="mt-8 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Tag className="w-5 h-5 text-amber-700 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Have a promo code? Apply it at checkout.</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Choose a plan to open checkout, then enter your code for instant discount.
            </p>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8">
        Payments are processed securely by Razorpay. We never see or store your card details.
      </p>

      {checkout && (
        <CheckoutModal
          plan={checkout.plan}
          billing={checkout.billing}
          currentTier={user.subscription_tier}
          alreadyHeld={planCardState(checkout.plan.tier, user.subscription_tier, checkout.billing, heldCycle) === 'current'}
          onClose={() => setCheckout(null)}
          onConfirm={(plan, promoCode) => payForSubscription(plan, checkout.billing, promoCode)}
        />
      )}
    </UserShell>
  );
}

/** "free" → "Free", "unlimited" → "Unlimited" — the backend's words, with a capital. */
const capital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** The yearly plan a buyer should take: a plan whose yearly price is below twelve months of monthly. */
function isBestValue(plan: SubscriptionPlanInfo): boolean {
  return plan.price_monthly > 0 && plan.price_yearly > 0 && plan.price_yearly < plan.price_monthly * 12;
}

async function handleDirectChange(
  tier: SubscriptionTier,
  upgradeSubscription: (t: SubscriptionTier) => Promise<{ ok: boolean }>,
) {
  const res = await upgradeSubscription(tier);
  if (res.ok) toast.success(`Switched to ${tier} plan.`);
}

/**
 * One plan in one billing cycle: the price, the card's own words (headline, description, what is included,
 * what is not, who it is for) and the button for where the buyer stands. The words come from the backend.
 * A card carries one highlight at most: the best-value card has its ribbon, and the card the buyer holds
 * says so only when it is not the best-value one.
 */
function OptionCard({
  plan,
  billing,
  userTier,
  heldCycle,
  bestValue,
  onChoose,
}: {
  plan: SubscriptionPlanInfo;
  billing: Billing;
  userTier: SubscriptionTier;
  heldCycle: Billing | null;
  bestValue: boolean;
  onChoose: () => void;
}) {
  const cycle = cycleShown(plan, billing);
  const card = cardFor(plan, billing);
  const isFree = plan.price_monthly === 0;
  const price = getSubscriptionPlanPrice(plan, cycle);
  const state = planCardState(plan.tier, userTier, billing, heldCycle);
  const holds = userTier === plan.tier;
  const Icon = isFree ? Gift : bestValue ? Crown : Gem;
  const months = plan.duration_days_yearly ? Math.round(plan.duration_days_yearly / 30) : null;
  const priceOfMonths = plan.price_monthly > 0 ? Math.round(plan.price_yearly / plan.price_monthly) : null;
  const monthlyCost = costPerMonth(plan, cycle);
  const saving = plan.price_monthly * 12 - plan.price_yearly;
  // A paid plan is "current" only in the cycle the server says is held. When the cycle is not known, neither
  // card claims it — both offer to extend or renew instead.
  const isCurrent = (state === 'current' && (heldCycle !== null || isFree)) || (isFree && userTier === 'free');
  const showYourPlan = isCurrent && !bestValue;

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  const buyLabel =
    state === 'switch'
      ? billing === 'yearly'
        ? `Upgrade to Yearly — ${fmt(price)}`
        : `Switch to Monthly — ${fmt(price)}`
      : (card?.cta || (billing === 'yearly' ? `${holds ? 'Renew' : 'Get'} Yearly — ${fmt(price)}` : `${holds ? 'Extend' : 'Choose'} Monthly — ${fmt(price)}`));
  const buttonText = isCurrent ? '✓ Current Plan' : buyLabel;

  return (
    <div className="relative flex flex-col">
      {showYourPlan && (
        <span className="absolute right-4 top-4 z-10 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow">
          Your plan
        </span>
      )}
      {bestValue && months && priceOfMonths && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-full bg-orange-500 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow">
          Best Value · {months} Months for the Price of {priceOfMonths}
        </span>
      )}
      <div
        className={cn(
          'flex flex-1 flex-col rounded-2xl bg-white dark:bg-gray-900 p-5 sm:p-6',
          bestValue ? 'border-2 border-orange-500 shadow-lg shadow-orange-100 dark:shadow-orange-950/40' : 'border border-gray-200 dark:border-gray-800',
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl',
              bestValue ? 'bg-amber-50 text-amber-500 dark:bg-amber-500/10' : isFree ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-violet-50 text-violet-600 dark:bg-violet-500/10',
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {isFree ? plan.name : `${plan.name} ${billing === 'yearly' ? 'Yearly' : 'Monthly'}`}
          </h2>
        </div>

        <p className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
          {fmt(price)}
          {!isFree && <span className="ml-1 text-sm font-semibold text-gray-500 dark:text-gray-400">/ {billing === 'yearly' ? 'year' : 'month'}</span>}
          {!isFree && <span className="ml-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400">{GST_LABEL}</span>}
        </p>
        {bestValue && monthlyCost !== null && saving > 0 && (
          <p className="mt-2 inline-block rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            Just {fmt(monthlyCost)} per month — save {fmt(saving)} compared to the Monthly Plan.
          </p>
        )}

        {card?.headline && <p className="mt-4 text-[15px] font-extrabold leading-snug text-gray-900 dark:text-gray-100">{card.headline}</p>}
        {card?.description && <p className="mt-2 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">{card.description}</p>}

        {card ? (
          <>
            {card.included.length > 0 && (
              <p className="mt-5 text-[11px] font-extrabold uppercase tracking-wider text-gray-500 dark:text-gray-400">What’s included</p>
            )}
            <ul className="mt-3 flex-1 space-y-3">
              {card.included.map(item => (
                <li key={item.title} className="flex items-start gap-2.5 text-sm leading-snug text-gray-700 dark:text-gray-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500 dark:text-emerald-400" aria-hidden />
                  <span>
                    <strong className="text-gray-900 dark:text-gray-100">{item.title}</strong>
                    {item.detail && <span className="text-[13px]"> – {item.detail}</span>}
                  </span>
                </li>
              ))}
              {card.excluded.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm leading-snug text-gray-400 dark:text-gray-500">
                  <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className="mt-4 mb-5 flex-1 space-y-2.5">
            {perksFor(plan, billing).map(p => (
              <li key={p} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500 dark:text-emerald-400" />
                {p}
              </li>
            ))}
          </ul>
        )}

        {card?.best_for && (
          <p className="mt-5 rounded-xl bg-gray-50 dark:bg-gray-800/60 px-3.5 py-3 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
            <strong className="text-gray-900 dark:text-gray-100">Best for:</strong> {card.best_for}
          </p>
        )}

        {/* The free plan has no button: it is what the account starts on, and nothing is bought. */}
        {!isFree && (
          <button
            type="button"
            onClick={onChoose}
            disabled={isCurrent}
            className={cn(
              'mt-5 w-full rounded-xl py-3 text-sm font-bold transition-all',
              isCurrent
                ? 'border border-gray-200 bg-gray-50 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 cursor-not-allowed'
                : bestValue
                  ? 'bg-orange-600 text-white hover:bg-orange-700 shadow-md shadow-orange-200 dark:shadow-orange-950/40'
                  : 'border-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/30',
            )}
          >
            {buttonText}
          </button>
        )}
      </div>
    </div>
  );
}

/** A pack's line under its name: its contents, in the words the design uses. */
function packContents(p: TopUpPack): string {
  if (p.mock > 0 && p.practice > 0) return `${p.mock} Mock + ${p.practice} Practice Tests`;
  if (p.mock > 0) return `${p.mock} Mock Test${p.mock === 1 ? '' : 's'}`;
  return `${p.practice} Practice Test${p.practice === 1 ? '' : 's'}`;
}

/**
 * Top-up packs, under "Need more tests?" — the packs, the saved balance and whether they can buy now come
 * from `/user/topup/packs`. A pack is chosen, then bought from the bar beneath the packs. The section is left
 * out while the packs are loading or cannot be fetched, rather than showing a made-up list.
 */
function TopUpSection({ customer }: { customer: { name: string; email: string; contact?: string | null } }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['topup', 'packs'], queryFn: getTopUpPacks, staleTime: 60 * 1000 });
  const [picked, setPicked] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  // A promo code is checked against one pack: choosing another pack, or removing the code, drops the preview.
  const [promoInput, setPromoInput] = useState('');
  const [checkingPromo, setCheckingPromo] = useState(false);
  const [applied, setApplied] = useState<{ code: string; packId: string; quote: TopUpPromoQuote } | null>(null);

  // "Buy a Top-up" in a plan popup arrives here with `?topup=1`: bring the packs into view once they have loaded.
  const section = useRef<HTMLElement>(null);
  const wantsTopUp = new URLSearchParams(useLocation().search).has('topup');
  const hasPacks = !!data && data.packs.length > 0;
  useEffect(() => {
    if (wantsTopUp && hasPacks) section.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [wantsTopUp, hasPacks]);

  if (!data || data.packs.length === 0) return null;

  const combo = data.packs.filter(p => p.mock > 0 && p.practice > 0);
  const mockPacks = data.packs.filter(p => p.mock > 0 && p.practice === 0);
  const practicePacks = data.packs.filter(p => p.practice > 0 && p.mock === 0);
  const other = data.packs.filter(p => p.mock === 0 && p.practice === 0);
  const columns = [
    { title: 'Combo packs', packs: combo },
    { title: 'Mock test packs', packs: mockPacks },
    { title: 'Practice test packs', packs: practicePacks },
    ...(other.length ? [{ title: 'Other packs', packs: other }] : []),
  ].filter(c => c.packs.length > 0);

  // The best-value combo is the pack with the lowest price per test, when there is more than one combo to compare.
  // It is tagged, and it is the default choice, as in the design.
  const perTestPrice = (p: TopUpPack) => p.price / Math.max(1, p.mock + p.practice);
  const bestCombo =
    combo.length > 1 ? combo.reduce((best, p) => (perTestPrice(p) < perTestPrice(best) ? p : best)) : null;

  // The pack chosen: the one the buyer picked, else the best-value combo, else the first combo, else the first pack.
  const chosen = data.packs.find(p => p.pack_id === picked) ?? bestCombo ?? combo[0] ?? data.packs[0];

  // The code only counts for the pack it was checked against.
  const promo = applied && applied.packId === chosen.pack_id ? applied : null;
  const payable = promo?.quote.final_amount ?? chosen.price;

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) {
      toast.error('Enter a promo code');
      return;
    }
    setCheckingPromo(true);
    try {
      const quote = await validateTopUpPromo(code, chosen.pack_id);
      if (!quote.valid) {
        toast.error(quote.message || 'That promo code is not valid.');
        return;
      }
      setApplied({ code, packId: chosen.pack_id, quote });
      toast.success(quote.message || 'Promo applied.');
    } catch (err: any) {
      toast.error(err?.message || 'Could not check that code. Please try again.');
    } finally {
      setCheckingPromo(false);
    }
  };

  const clearPromo = () => {
    setApplied(null);
    setPromoInput('');
  };

  const buy = async () => {
    setBuying(true);
    const outcome = await purchaseTopUp(
      { packId: chosen.pack_id, packName: chosen.name, promoCode: promo?.code, customer },
      { createOrder: createTopUpOrder, verifyPayment: verifyTopUp, openCheckout },
    );
    setBuying(false);
    // The balance (and so the attempts badge) and the purchase list both change with a payment.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['topup'] }),
      queryClient.invalidateQueries({ queryKey: ['purchase-history'] }),
    ]);
    switch (outcome.kind) {
      case 'paid':
        toast.success(`${chosen.name} added. You now have ${outcome.balance.mock} mock and ${outcome.balance.practice} practice tests saved.`);
        clearPromo();
        break;
      case 'cancelled':
        toast.info('Payment cancelled — you have not been charged.');
        break;
      case 'failed':
        toast.error(outcome.message);
        break;
      case 'unconfirmed':
        toast.warning(outcome.message, { duration: 30_000 });
        break;
    }
  };

  return (
    <section ref={section} id="top-ups" className="mt-12 animate-fadeIn scroll-mt-24">
      <h2 className="border-l-4 border-orange-500 pl-3 text-2xl font-extrabold text-gray-900 dark:text-gray-100">Need more tests?</h2>
      <p className="mt-1 max-w-xl text-sm text-gray-600 dark:text-gray-400">
        Add a top-up to your Monthly or Yearly plan. Unused top-up tests are saved and carried forward when you renew your subscription.
      </p>

      {!data.can_purchase && data.reason && (
        <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 px-4 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
          {data.reason}
        </div>
      )}

      {/* One panel, a column for each kind of pack and a row for each pack in it (two, today): choose a row, and the
          pay bar below shows what you chose. On a phone the columns stack. */}
      <div
        className={cn(
          'mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900',
          'lg:grid lg:divide-x lg:divide-gray-200 dark:lg:divide-gray-800',
          columns.length >= 3 ? 'lg:grid-cols-3' : columns.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1',
        )}
        role="radiogroup"
        aria-label="Top-up packs"
      >
        {columns.map((col, ci) => (
          <div key={col.title} className={cn('flex flex-col', ci > 0 && 'border-t border-gray-200 dark:border-gray-800 lg:border-t-0')}>
            <div className="flex items-center justify-between bg-gray-50 px-4 py-2 dark:bg-gray-800/60">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">{col.title}</p>
              <p className="text-[11px] text-gray-400">{col.packs.length} option{col.packs.length === 1 ? '' : 's'}</p>
            </div>
            <ul className="flex-1 divide-y divide-gray-100 dark:divide-gray-800">
              {col.packs.map(pack => {
                const on = pack.pack_id === chosen.pack_id;
                const best = !!bestCombo && pack.pack_id === bestCombo.pack_id;
                return (
                  <li key={pack.pack_id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPicked(pack.pack_id)}
                      className={cn(
                        'relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors sm:gap-4',
                        on ? 'bg-orange-50 dark:bg-orange-950/25' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                      )}
                    >
                      {/* The chosen row carries a bar down its left edge. */}
                      <span className={cn('absolute inset-y-0 left-0 w-1 transition-colors', on ? 'bg-orange-500' : 'bg-transparent')} aria-hidden />
                      <span
                        className={cn(
                          'grid h-5 w-5 flex-shrink-0 place-items-center rounded-full border-2 transition-colors',
                          on ? 'border-orange-500 bg-orange-500 text-white' : 'border-gray-300 dark:border-gray-600',
                        )}
                        aria-hidden
                      >
                        {on && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                          {pack.name}
                          {best && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                              Best value
                            </span>
                          )}
                        </p>
                        {pack.description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{pack.description}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {pack.mock > 0 && (
                            <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                              {pack.mock} Mock
                            </span>
                          )}
                          {pack.practice > 0 && (
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              {pack.practice} Practice
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="flex-shrink-0 text-lg font-extrabold tabular-nums text-gray-900 dark:text-gray-100">
                        ₹{pack.price.toLocaleString('en-IN')}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* The pay bar stays in view while the packs are read, as the design has it at the foot of the screen. */}
      <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-gray-900 px-5 py-4 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between lg:sticky lg:bottom-4 lg:z-20">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-gray-400">Selected top-up</p>
          <p className="truncate text-sm font-bold">
            {chosen.name} <span className="font-normal text-gray-300">· {packContents(chosen)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          {promo ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs">
              <BadgePercent className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
              <span className="font-bold text-emerald-300">
                {promo.code}
                {promo.quote.discount_amount ? ` · −₹${promo.quote.discount_amount.toLocaleString('en-IN')}` : ''}
              </span>
              <button type="button" onClick={clearPromo} className="font-semibold uppercase tracking-wider text-gray-400 hover:text-red-400">
                Remove
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={e => setPromoInput(e.target.value.toUpperCase())}
                onKeyDown={e => {
                  if (e.key === 'Enter') applyPromo();
                }}
                placeholder="Promo code"
                aria-label="Promo code"
                className="w-36 rounded-lg border border-orange-400/40 bg-white/10 px-3 py-2 text-xs uppercase tracking-wide text-white placeholder:normal-case placeholder:text-gray-300 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/60"
              />
              <button
                type="button"
                onClick={applyPromo}
                disabled={checkingPromo || !promoInput.trim()}
                className="rounded-lg bg-orange-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-orange-400 disabled:bg-white/10 disabled:text-gray-400"
              >
                {checkingPromo ? 'Checking…' : 'Apply'}
              </button>
            </div>
          )}
          <p className="text-xl font-extrabold">
            {promo && payable < chosen.price && (
              <span className="mr-2 text-sm font-semibold text-gray-400 line-through">₹{chosen.price.toLocaleString('en-IN')}</span>
            )}
            {payable === 0 ? 'Free' : `₹${payable.toLocaleString('en-IN')}`}
          </p>
          <button
            type="button"
            onClick={buy}
            disabled={!data.can_purchase || buying}
            className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buying ? 'Opening…' : payable === 0 ? 'Add pack' : 'Pay now'}
          </button>
        </div>
      </div>

      <HowTopUpsWork />
    </section>
  );
}

/** The four steps, as the design sets them out. */
function HowTopUpsWork() {
  const steps = [
    "Buy a Monthly or Yearly plan first. Top-ups can't be added to Free.",
    "Your plan's tests are used first. Top-up tests are used after.",
    "When your plan ends, unused top-up tests are saved. Plan tests expire with the plan.",
    "Renew any plan and your saved tests unlock again.",
  ];
  return (
    <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">How top-ups work</h3>
      <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, i) => (
          <li key={step} className="flex items-start gap-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <span className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-full bg-orange-100 text-xs font-bold text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-[11px] text-gray-500 dark:text-gray-400">
        Top-ups are non-refundable and non-transferable. Terms apply.
      </p>
    </div>
  );
}

interface CheckoutModalProps {
  plan: SubscriptionPlanInfo;
  billing: 'monthly' | 'yearly';
  currentTier: SubscriptionTier;
  /** The plan, in this billing cycle, is the one they already hold — nothing to buy. */
  alreadyHeld: boolean;
  onClose: () => void;
  /** Runs the purchase and reports how it ended. */
  onConfirm: (plan: SubscriptionPlanInfo, promoCode?: string) => Promise<PurchaseOutcome>;
}

function CheckoutModal({ plan, billing, currentTier, alreadyHeld, onClose, onConfirm }: CheckoutModalProps) {
  const queryClient = useQueryClient();
  const [promoInput, setPromoInput] = useState('');
  /** The server's priced answer for the code, when it gave GST figures — what the summary shows. */
  const [quote, setQuote] = useState<PromoValidation | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<SubscriptionPromoCode | null>(null);
  const [paying, setPaying] = useState(false);
  const [checkingPromo, setCheckingPromo] = useState(false);

  // Four or fewer points are all shown: the last is usually the validity, which a buyer needs to see,
  // and "+ 1 more" would hide exactly that. A longer list is cut to three with a count.
  const perks = perksFor(plan, billing);
  const shownPerks = perks.length <= 4 ? perks : perks.slice(0, 3);
  const hiddenPerks = perks.length - shownPerks.length;

  const basePrice = useMemo(() => getSubscriptionPlanPrice(plan, billing), [plan, billing]);
  const finalPrice = useMemo(() => getEffectivePlanPrice(plan, billing, appliedPromo), [plan, billing, appliedPromo]);
  const discount = basePrice - finalPrice;
  // The server's own breakdown, GST included. Without it the summary shows the price, inclusive of GST.
  const breakdown = appliedPromo ? breakdownFrom(quote) : null;
  const rs = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  /**
   * Check the code with the server.
   *
   * The percentage shown here is a preview — the server applies the code again when it creates the order,
   * and what Razorpay charges is that figure, not this one.
   */
  const handleApply = async () => {
    const code = promoInput.trim();
    if (!code) {
      toast.error('Enter a promo code');
      return;
    }
    setCheckingPromo(true);
    try {
      const res = await validatePromo(code, { plan_id: plan.plan_id, billing_cycle: billing });
      if (!res.valid) {
        toast.error(res.message || 'That promo code is not valid.');
        return;
      }
      setQuote(res);
      setAppliedPromo({ code, discount_pct: res.discount_pct, label: res.message });
      toast.success(
        res.discount_pct >= 100 ? 'Promo applied — this plan is free for this cycle!' : `Promo applied — ${res.discount_pct}% off!`,
      );
    } catch (err: any) {
      toast.error(err?.message || 'Could not check that code. Please try again.');
    } finally {
      setCheckingPromo(false);
    }
  };

  const handleClearPromo = () => {
    setQuote(null);
    setAppliedPromo(null);
    setPromoInput('');
  };

  const handlePay = async () => {
    setPaying(true);
    const outcome = await onConfirm(plan, appliedPromo?.code);
    setPaying(false);
    // A payment that went through changes the purchase list, the top-up balance and the plan held.
    if (outcome.kind === 'paid' || outcome.kind === 'free' || outcome.kind === 'unconfirmed') {
      void queryClient.invalidateQueries({ queryKey: ['purchase-history'] });
      void queryClient.invalidateQueries({ queryKey: ['topup'] });
      void queryClient.invalidateQueries({ queryKey: ['subscription', 'current'] });
    }

    switch (outcome.kind) {
      case 'paid': {
        const until = new Date(outcome.result.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const invoice = outcome.result.invoice_no ? ` Invoice ${outcome.result.invoice_no}.` : '';
        toast.success(`Payment successful — ${plan.name} is active until ${until}.${invoice}`);
        onClose();
        break;
      }
      case 'free':
        toast.success(`${plan.name} activated.`);
        onClose();
        break;
      case 'cancelled':
        // Stay open so they can try again; nothing alarming to say.
        toast.info('Payment cancelled — you have not been charged.');
        break;
      case 'failed':
        toast.error(outcome.message);
        break;
      case 'unconfirmed':
        // Money may have moved. This must not read as a failure, and must outlast a glance.
        toast.warning(outcome.message, { duration: 30_000 });
        onClose();
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div
        // Never taller than the screen: the middle scrolls, the header and the Pay button stay in view. Without a
        // height limit the card ran past a short screen and, being `overflow-hidden`, was cut off with no way to scroll.
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={cn(
            'relative shrink-0 p-5 overflow-hidden text-white',
            plan.tier === 'premium' ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500' : 'bg-gradient-to-br from-brand-500 via-brand-400 to-pink-500',
            'bg-[length:200%_auto] animate-gradient-x',
          )}
        >
          <div className="absolute inset-0 bg-soft-dots opacity-15" />
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/15 rounded-full blur-3xl pointer-events-none" />

          <button
            onClick={onClose}
            // z-10: the title block after it is also positioned and spans the header, so without this it sits on top and takes the click.
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.25em] font-bold opacity-90">Checkout</p>
            <h2 className="text-xl font-bold mt-1 flex items-center gap-2">
              {plan.tier === 'premium' && <Crown className="w-5 h-5" />}
              {plan.name}
              <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold capitalize">{billing}</span>
            </h2>
            <p className="text-xs opacity-90 mt-0.5 capitalize">
              {billing} billing · {plan.tier === currentTier ? `switching your ${currentTier} plan` : `upgrading from ${currentTier}`}
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {/* Plan summary */}
          <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 rounded-xl p-3 mb-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">What you get</p>
            <ul className="space-y-1">
              {shownPerks.map((p, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                  <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  {p}
                </li>
              ))}
              {hiddenPerks > 0 && <li className="text-[11px] text-gray-500 dark:text-gray-400 italic pl-4">+ {hiddenPerks} more perks</li>}
            </ul>
          </div>

          {/* Promo code */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 p-3 sm:p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Promo code</p>
            </div>

            {appliedPromo ? (
              <div className="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-900 rounded-lg p-2.5">
                <div className="flex items-start gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {appliedPromo.code} · {appliedPromo.discount_pct}% off
                    </p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 truncate">{appliedPromo.label}</p>
                  </div>
                </div>
                <button
                  onClick={handleClearPromo}
                  className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 uppercase tracking-wider flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoInput}
                  onChange={e => setPromoInput(e.target.value.toUpperCase())}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleApply();
                  }}
                  placeholder="Enter promo code"
                  className="flex-1 px-3 py-2 border border-amber-200 dark:border-amber-900 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-amber-400/60 dark:placeholder:text-amber-300/40 rounded-lg text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-700"
                />
                <button
                  onClick={handleApply}
                  disabled={checkingPromo}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors press disabled:opacity-60"
                >
                  {checkingPromo ? 'Checking…' : 'Apply'}
                </button>
              </div>
            )}

            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-2">The final amount is confirmed when you pay.</p>
          </div>

          {/* Price breakdown */}
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100">Order Summary</p>
            </div>

            {breakdown && isGstInclusive(breakdown) ? (
              // GST is inside the price: price, less any discount, is the total; the tax is shown as what it contains.
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span>Plan price (incl. GST)</span>
                  <span className="tabular-nums">{rs(breakdown.base_amount)}</span>
                </div>
                {breakdown.discount_amount > 0 && (
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <BadgePercent className="w-3.5 h-3.5" />
                      Discount ({appliedPromo?.code})
                    </span>
                    <span className="tabular-nums">−{rs(breakdown.discount_amount)}</span>
                  </div>
                )}
                <div className="border-t border-blue-100 dark:border-blue-900 my-2" />
                <div className="flex items-center justify-between text-base font-bold text-gray-900 dark:text-gray-100">
                  <span>Total</span>
                  <span className="tabular-nums">{rs(breakdown.final_amount)}</span>
                </div>
                <p className="pt-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 tabular-nums">
                  Includes taxable value {rs(breakdown.taxable_amount)} and GST @ {breakdown.gst_percent}% {rs(breakdown.gst_amount)}.
                </p>
              </div>
            ) : breakdown ? (
              // GST on top of the price (a server that has not changed over yet): the server's figures as they come.
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span>Plan price</span>
                  <span className="tabular-nums">{rs(breakdown.base_amount)}</span>
                </div>
                {breakdown.discount_amount > 0 && (
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <BadgePercent className="w-3.5 h-3.5" />
                      Discount ({appliedPromo?.code})
                    </span>
                    <span className="tabular-nums">−{rs(breakdown.discount_amount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span>Taxable value</span>
                  <span className="tabular-nums">{rs(breakdown.taxable_amount)}</span>
                </div>
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span>GST @ {breakdown.gst_percent}%</span>
                  <span className="tabular-nums">{rs(breakdown.gst_amount)}</span>
                </div>
                <div className="border-t border-blue-100 dark:border-blue-900 my-2" />
                <div className="flex items-center justify-between text-base font-bold text-gray-900 dark:text-gray-100">
                  <span>Total</span>
                  <span className="tabular-nums">{rs(breakdown.final_amount)}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                  <span>
                    {plan.name} · {billing === 'monthly' ? '1 month' : '1 year'}
                  </span>
                  <span className="tabular-nums">₹{basePrice.toLocaleString('en-IN')}</span>
                </div>

                {appliedPromo && discount > 0 && (
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <BadgePercent className="w-3.5 h-3.5" />
                      Promo ({appliedPromo.discount_pct}%)
                    </span>
                    <span className="tabular-nums">−₹{discount.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="border-t border-blue-100 dark:border-blue-900 my-2" />

                <div className="flex items-center justify-between text-base font-bold text-gray-900 dark:text-gray-100">
                  <span>{finalPrice === 0 ? 'Total' : 'Price'}</span>
                  <span className="inline-flex items-baseline gap-1.5 tabular-nums">
                    {finalPrice === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400">FREE</span>
                    ) : (
                      <>
                        <span className="inline-flex items-center">
                          <IndianRupee className="w-4 h-4" />
                          {finalPrice.toLocaleString('en-IN')}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                {finalPrice > 0 && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Price is inclusive of GST.</p>
                )}
              </div>
            )}

          </div>

        </div>

        {/* Pinned to the foot of the card, so paying is never below the fold. */}
        <div className="shrink-0 border-t border-gray-100 p-4 dark:border-gray-800 sm:px-6">
          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={paying || alreadyHeld || !plan.plan_id}
            className="w-full bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 bg-[length:200%_auto] hover:bg-right-bottom text-white py-3 rounded-xl font-semibold transition-all duration-500 shadow-lg shadow-blue-200 dark:shadow-blue-900/40 hover:shadow-xl hover:shadow-blue-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none press"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {paying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing payment…
                </>
              ) : finalPrice === 0 ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Activate Plan (Free)
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  {breakdown ? `Pay ${rs(breakdown.final_amount)} & Subscribe` : 'Pay & Subscribe'}
                </>
              )}
            </span>
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <ShieldCheck className="w-3 h-3" />
            {plan.plan_id
              ? 'Secure payment by Razorpay — card, UPI and net banking.'
              : 'Plans have not loaded from the server, so this cannot be bought right now. Refresh the page.'}
          </p>
        </div>
      </div>
    </div>
  );
}
