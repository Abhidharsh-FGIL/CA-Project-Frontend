import { useMemo, useState } from 'react';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import {
  Check,
  Crown,
  Sparkles,
  Star,
  X,
  Tag,
  CheckCircle2,
  CreditCard,
  Loader2,
  BadgePercent,
  IndianRupee,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  SUBSCRIPTION_PROMO_CODES,
  validateSubscriptionPromo,
  getEffectivePlanPrice,
  getSubscriptionPlanPrice,
  type SubscriptionTier,
  type SubscriptionPlanInfo,
  type SubscriptionPromoCode,
} from '@/data/userPortalSampleData';

export default function SubscriptionPage() {
  const { user, plans, upgradeSubscription, payForSubscription } = useUserPortal();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [checkoutPlan, setCheckoutPlan] = useState<SubscriptionPlanInfo | null>(null);

  if (!user) return null;

  return (
    <UserShell>
      {/* Hero header */}
      <div className="mb-8 animate-fadeIn">
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/50 dark:via-purple-950/50 dark:to-pink-950/50 bg-[length:200%_auto] animate-gradient-x p-6 sm:p-8 text-center">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-300/30 dark:bg-purple-700/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-300/30 dark:bg-indigo-700/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-gray-900/60 backdrop-blur border border-indigo-200 dark:border-indigo-800 rounded-full px-3 py-1 mb-4">
              <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
              <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-700 dark:text-indigo-300 font-bold">
                Upgrade · Unlock More
              </p>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100">
              Choose Your <span className="gradient-text-animated">Plan</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-3 max-w-xl mx-auto">
              Unlock more practice, mock tests, and detailed AI reports. You're currently on{' '}
              <strong className="text-indigo-600 dark:text-indigo-400 capitalize">{user.subscription_tier}</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Billing toggle */}
      <div className="text-center mb-6 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
        <div className="inline-flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-1 shadow-sm">
          <button
            onClick={() => setBilling('monthly')}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-semibold transition-all',
              billing === 'monthly'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400',
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling('yearly')}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5',
              billing === 'yearly'
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400',
            )}
          >
            Yearly
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full">SAVE 16%</span>
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:pt-3">
        {plans.map((plan, i) => {
          const isCurrent = plan.tier === user.subscription_tier;
          const price = getSubscriptionPlanPrice(plan, billing);
          return (
            <div
              key={`${plan.tier}-${billing}`}
              className={cn('relative animate-slideUp', plan.highlight && 'lg:-translate-y-2')}
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              {plan.highlight && (
                <>
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl opacity-20 blur pointer-events-none" />
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 animate-bounce-soft whitespace-nowrap">
                    ★ Most Popular
                  </span>
                </>
              )}

              <div
                className={cn(
                  'relative bg-white dark:bg-gray-900 rounded-2xl border p-5 sm:p-6 transition-all duration-300 hover-lift card-shine h-full',
                  plan.highlight
                    ? 'border-indigo-500 dark:border-indigo-400 shadow-xl shadow-indigo-200 dark:shadow-indigo-900/40'
                    : 'border-gray-200 dark:border-gray-800 shadow-sm hover:shadow-lg hover:shadow-indigo-100/50 dark:hover:shadow-black/50 hover:border-indigo-200 dark:hover:border-indigo-800',
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  {plan.tier === 'free' && <Star className="w-4 h-4 text-gray-400 dark:text-gray-500" />}
                  {plan.tier === 'standard' && <Sparkles className="w-4 h-4 text-blue-500 dark:text-blue-400" />}
                  {plan.tier === 'ultimate' && <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                  {plan.tier === 'premium' && <Crown className="w-4 h-4 text-amber-500 dark:text-amber-400" />}
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{plan.name}</h2>
                </div>

                <div className="mb-5 relative">
                  {price === 0 ? (
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">Free</p>
                  ) : (
                    <div key={`${plan.tier}-${billing}-price`} className="flex items-baseline gap-1 animate-fadeIn">
                      <p
                        className={cn(
                          'text-3xl font-bold',
                          plan.highlight ? 'gradient-text' : 'text-gray-900 dark:text-gray-100',
                        )}
                      >
                        ₹{price.toLocaleString('en-IN')}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">/{billing === 'monthly' ? 'mo' : 'yr'}</p>
                    </div>
                  )}
                </div>

                <ul className="space-y-2 mb-6 sm:min-h-[200px]">
                  {plan.perks.map((p, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 animate-fadeIn"
                      style={{ animationDelay: `${0.2 + idx * 0.05}s` }}
                    >
                      <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                    History retention:{' '}
                    <strong className="text-gray-700 dark:text-gray-200">
                      {plan.features.history_retention_days === 'unlimited'
                        ? 'Unlimited'
                        : `${plan.features.history_retention_days} days`}
                    </strong>
                  </li>
                  <li className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                    Support: <strong className="text-gray-700 dark:text-gray-200">{plan.features.support}</strong>
                  </li>
                </ul>

                <button
                  onClick={() => {
                    if (isCurrent) return;
                    if (plan.tier === 'free') {
                      // Direct downgrade — no payment / no promo needed
                      handleDirectChange(plan.tier, upgradeSubscription);
                      return;
                    }
                    setCheckoutPlan(plan);
                  }}
                  disabled={isCurrent}
                  className={cn(
                    'w-full py-2.5 rounded-xl text-sm font-semibold transition-all press',
                    isCurrent
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : plan.highlight
                      ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right-bottom text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 hover:shadow-xl hover:shadow-indigo-300'
                      : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 hover:shadow-md',
                  )}
                >
                  {isCurrent ? '✓ Current Plan' : plan.tier === 'free' ? 'Downgrade' : 'Choose Plan'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Promo hint strip */}
      <div className="mt-8 max-w-3xl mx-auto rounded-xl border border-amber-100 dark:border-amber-900 bg-gradient-to-r from-amber-50/80 via-orange-50/80 to-rose-50/80 dark:from-amber-950/30 dark:via-orange-950/30 dark:to-rose-950/30 p-4 sm:p-5 animate-fadeIn">
        <div className="flex items-start gap-3">
          <Tag className="w-5 h-5 text-amber-700 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
              Have a promo code? Apply it at checkout.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Click any "Choose Plan" button to open checkout, then enter your code for instant discount.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUBSCRIPTION_PROMO_CODES.map(p => (
                <code
                  key={p.code}
                  className="text-[10px] font-bold bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded"
                  title={p.label}
                >
                  {p.code}
                </code>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8">
        Sample portal — no real payment is collected. Real backend will integrate with Razorpay/Stripe.
      </p>

      {checkoutPlan && (
        <CheckoutModal
          plan={checkoutPlan}
          billing={billing}
          currentTier={user.subscription_tier}
          onClose={() => setCheckoutPlan(null)}
          onConfirm={async (tier, baseAmount, finalAmount, promoCode) => {
            const res = await payForSubscription(tier, billing, baseAmount, finalAmount, promoCode);
            return res.ok;
          }}
        />
      )}
    </UserShell>
  );
}

async function handleDirectChange(
  tier: SubscriptionTier,
  upgradeSubscription: (t: SubscriptionTier) => Promise<{ ok: boolean }>,
) {
  const res = await upgradeSubscription(tier);
  if (res.ok) toast.success(`Switched to ${tier} plan.`);
}

interface CheckoutModalProps {
  plan: SubscriptionPlanInfo;
  billing: 'monthly' | 'yearly';
  currentTier: SubscriptionTier;
  onClose: () => void;
  onConfirm: (
    tier: SubscriptionTier,
    baseAmount: number,
    finalAmount: number,
    promoCode?: string,
  ) => Promise<boolean>;
}

function CheckoutModal({ plan, billing, currentTier, onClose, onConfirm }: CheckoutModalProps) {
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<SubscriptionPromoCode | null>(null);
  const [paying, setPaying] = useState(false);

  const basePrice = useMemo(() => getSubscriptionPlanPrice(plan, billing), [plan, billing]);
  const finalPrice = useMemo(
    () => getEffectivePlanPrice(plan, billing, appliedPromo),
    [plan, billing, appliedPromo],
  );
  const discount = basePrice - finalPrice;
  const isDowngradeOrSame = plan.tier === currentTier;

  const handleApply = () => {
    if (!promoInput.trim()) {
      toast.error('Enter a promo code');
      return;
    }
    const res = validateSubscriptionPromo(promoInput, plan.tier, billing);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAppliedPromo(res.promo);
    if (res.promo.discount_pct >= 100) {
      toast.success('Promo applied — this plan is free for this cycle!');
    } else {
      toast.success(`Promo applied — ${res.promo.discount_pct}% off!`);
    }
  };

  const handleClearPromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
  };

  const handlePay = async () => {
    setPaying(true);
    const ok = await onConfirm(plan.tier, basePrice, finalPrice, appliedPromo?.code);
    setPaying(false);
    if (ok) {
      if (finalPrice === 0) {
        toast.success(`${plan.name} activated — free with promo!`);
      } else {
        toast.success(`Payment of ₹${finalPrice} successful — ${plan.name} activated!`);
      }
      onClose();
    } else {
      toast.error('Payment failed. Please try again.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={cn(
            'relative p-5 overflow-hidden text-white',
            plan.tier === 'premium'
              ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500'
              : 'bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500',
            'bg-[length:200%_auto] animate-gradient-x',
          )}
        >
          <div className="absolute inset-0 bg-soft-dots opacity-15" />
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/15 rounded-full blur-3xl pointer-events-none" />

          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.25em] font-bold opacity-90">Checkout</p>
            <h2 className="text-xl font-bold mt-1 flex items-center gap-2">
              {plan.tier === 'premium' && <Crown className="w-5 h-5" />}
              {plan.name}
            </h2>
            <p className="text-xs opacity-90 mt-0.5 capitalize">
              {billing} billing · upgrading from {currentTier}
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {/* Plan summary */}
          <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700 rounded-xl p-3 mb-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400 mb-1">
              What you get
            </p>
            <ul className="space-y-1">
              {plan.perks.slice(0, 3).map((p, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
                  <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  {p}
                </li>
              ))}
              {plan.perks.length > 3 && (
                <li className="text-[11px] text-gray-500 dark:text-gray-400 italic pl-4">
                  + {plan.perks.length - 3} more perks
                </li>
              )}
            </ul>
          </div>

          {/* Promo code */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 p-3 sm:p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Promo code
              </p>
            </div>

            {appliedPromo ? (
              <div className="flex items-center justify-between gap-2 bg-white dark:bg-gray-900 border border-emerald-200 dark:border-emerald-900 rounded-lg p-2.5">
                <div className="flex items-start gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {appliedPromo.code} · {appliedPromo.discount_pct}% off
                    </p>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 truncate">
                      {appliedPromo.label}
                    </p>
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
                  placeholder="Enter code (e.g. WELCOME26)"
                  className="flex-1 px-3 py-2 border border-amber-200 dark:border-amber-900 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-amber-400/60 dark:placeholder:text-amber-300/40 rounded-lg text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-700"
                />
                <button
                  onClick={handleApply}
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors press"
                >
                  Apply
                </button>
              </div>
            )}

            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-2">
              Try: <code className="bg-white dark:bg-gray-800 dark:text-amber-200 px-1 rounded">WELCOME26</code>{' '}
              <span className="opacity-70">(50% off)</span> ·{' '}
              <code className="bg-white dark:bg-gray-800 dark:text-amber-200 px-1 rounded">STUDENT100</code>{' '}
              <span className="opacity-70">(Standard free)</span>
            </p>
          </div>

          {/* Price breakdown */}
          <div className="rounded-xl border border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/60 dark:from-indigo-950/30 dark:via-gray-900 dark:to-purple-950/30 p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <p className="text-xs font-bold text-gray-900 dark:text-gray-100">Order Summary</p>
            </div>

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

              <div className="border-t border-indigo-100 dark:border-indigo-900 my-2" />

              <div className="flex items-center justify-between text-base font-bold text-gray-900 dark:text-gray-100">
                <span>Total</span>
                <span className="inline-flex items-center tabular-nums">
                  {finalPrice === 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">FREE</span>
                  ) : (
                    <>
                      <IndianRupee className="w-4 h-4" />
                      {finalPrice.toLocaleString('en-IN')}
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={paying || isDowngradeOrSame}
            className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right-bottom text-white py-3 rounded-xl font-semibold transition-all duration-500 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 hover:shadow-xl hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none press"
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
                  Pay ₹{finalPrice.toLocaleString('en-IN')} & Subscribe
                </>
              )}
            </span>
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <ShieldCheck className="w-3 h-3" />
            Demo mode — no real payment will be charged.
          </p>
        </div>
      </div>
    </div>
  );
}
