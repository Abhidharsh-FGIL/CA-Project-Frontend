import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Check, ClipboardCheck, GraduationCap, Lock, Star, type LucideIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { getPlan } from '@/data/userPortalSampleData';
import {
  composePlanNotice,
  subscriptionExpired,
  subscriptionLapsed,
  type NoticeIcon,
  type NoticeOption,
  type PlanErrorFacts,
} from '@/lib/plan-notice';
import { onPlanNotice, showPlanNotice } from '@/lib/plan-notice-bus';
import { billingCycleOf, planAllowance } from '@/lib/plan-allowance';
import { getCurrentSubscription } from '@/lib/subscriptionApi';
import { useCurrentPlanPurchase } from '@/hooks/use-plan-purchase';
import { cn } from '@/lib/utils';

const ICONS: Record<NoticeIcon, LucideIcon> = {
  lock: Lock,
  clipboard: ClipboardCheck,
  graduation: GraduationCap,
  calendar: CalendarClock,
};

/** Set once the "your plan has expired" popup has opened this session, so it is not raised on every page. */
const EXPIRY_SEEN = 'mge.expiry-notice-seen';

/** `**bold**` in a notice's text, as bold. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, i) =>
        i % 2 ? (
          <strong key={i} className="font-semibold text-gray-900 dark:text-white">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

const ACTION = 'w-full h-12 rounded-xl text-base font-semibold';
const ORANGE = 'bg-orange-500 text-white hover:bg-orange-600';

/**
 * The popup for a plan that will not do what was asked — a test past the plan's allowance, a plan that
 * has run out of time, a report the plan does not include.
 *
 * Mounted once inside the user portal. Whatever hits the wall hands the facts to `showPlanNotice` (or a
 * refused call to `announcePlanNotice`); this works out what to say from the person's own plan, what
 * they have used and when it began, and shows it.
 */
export default function PlanNoticeHost() {
  const { user, plans, history, assessments } = useUserPortal();
  const navigate = useNavigate();
  const [facts, setFacts] = useState<PlanErrorFacts | null>(null);
  const [open, setOpen] = useState(false);

  // When the current plan began and ended: what separates this plan's tests from earlier ones, and
  // whether it was monthly or yearly. Only for someone signed in — the portal's login pages mount this too.
  const planPurchase = useCurrentPlanPurchase();
  const { data: sub } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: getCurrentSubscription,
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  useEffect(
    () =>
      onPlanNotice(next => {
        setFacts(next);
        setOpen(true);
      }),
    [],
  );

  const tier = user?.subscription_tier;
  const lapsed = subscriptionLapsed(tier, user?.subscription_expiry, sub?.status);

  // A paid plan whose end date has passed: tell them once a session, rather than wait for a test to be refused.
  useEffect(() => {
    if (!user || user.subscription_tier === 'free') return;
    if (!subscriptionLapsed(user.subscription_tier, user.subscription_expiry)) return;
    try {
      if (sessionStorage.getItem(EXPIRY_SEEN)) return;
      sessionStorage.setItem(EXPIRY_SEEN, '1');
    } catch {
      /* No storage: it can only be shown again, not skipped. */
    }
    showPlanNotice(subscriptionExpired());
  }, [user]);

  const notice = useMemo(() => {
    if (!facts) return null;
    const current = user ? getPlan(user.subscription_tier) : null;
    const since = sub?.status === 'active' ? sub.start_date : null;
    const left = current
      ? {
          mock: planAllowance(current, 'mock', history, since, assessments, planPurchase).left,
          // Practice and Key Topics tests are one allowance — see `attemptKind`.
          practice: planAllowance(current, 'practice', history, since, assessments, planPurchase).left,
        }
      : undefined;
    // Out of time outranks out of tests: the plan to renew is the news, not its allowance.
    const effective =
      lapsed && (facts.code === 'PLAN_LIMIT_REACHED' || facts.code === 'PLAN_REQUIRED') ? subscriptionExpired() : facts;
    return composePlanNotice(effective, {
      current,
      plans,
      billing: sub ? billingCycleOf(sub.start_date, sub.end_date) : null,
      left,
      held: sub ? (plans.find(p => p.plan_id === sub.plan_id) ?? null) : null,
    });
  }, [facts, user, plans, history, assessments, sub, planPurchase, lapsed]);

  // `facts` stays after closing so the text does not vanish mid-animation.
  if (!notice) return null;
  const { suggestion, options, usage, secondary } = notice;
  const Icon = ICONS[notice.icon];

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent
        className={cn(
          'rounded-3xl p-0 gap-0 overflow-hidden w-[calc(100%-2rem)] max-h-[92dvh] overflow-y-auto',
          options.length > 0 ? 'max-w-lg' : 'max-w-md',
        )}
      >
        <div className="p-6 sm:p-7">
          <AlertDialogHeader className="items-center text-center sm:text-center space-y-3">
            <span className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 flex items-center justify-center">
              <Icon className="w-6 h-6" aria-hidden />
            </span>
            <AlertDialogTitle className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              {notice.title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
                {notice.body.map(line => (
                  <p key={line}>
                    <Rich text={line} />
                  </p>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {usage.length > 0 && (
            <div className="mt-5 rounded-2xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3 space-y-2.5">
              {usage.map(row => (
                <div key={row.label} className="flex items-center justify-between gap-3 text-[15px]">
                  <span className="text-gray-800 dark:text-gray-100">{row.label}</span>
                  <span
                    className={cn(
                      'font-medium',
                      row.tone === 'used' ? 'text-red-500' : 'text-emerald-700 dark:text-emerald-400',
                    )}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {options.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3">
              {options.map(o => (
                <OptionCard key={o.label} option={o} onChoose={() => navigate(o.to)} />
              ))}
            </div>
          )}

          {options.length === 0 && suggestion && (
            <div className="mt-5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{suggestion.name}</p>
                {suggestion.price != null && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">₹{suggestion.price.toLocaleString('en-IN')} / month</p>
                )}
              </div>
              {suggestion.points.length > 0 && (
                <ul className="mt-2.5 space-y-1.5">
                  {suggestion.points.map(point => (
                    <li key={point} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {(options.length === 0 || secondary) && (
            <div className="mt-5 space-y-2.5">
              {/* With plan cards, each card has its own button; the primary one is only for a popup without them. */}
              {options.length === 0 && (
                <AlertDialogAction className={cn(ACTION, ORANGE)} onClick={() => navigate(notice.primary.to)}>
                  {notice.primary.label}
                </AlertDialogAction>
              )}
              {secondary && (
                <AlertDialogAction
                  className={cn(
                    ACTION,
                    'bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 dark:bg-transparent dark:text-white dark:border-gray-600',
                  )}
                  onClick={() => navigate(secondary.to)}
                >
                  {secondary.label}
                </AlertDialogAction>
              )}
            </div>
          )}

          <AlertDialogCancel className="mt-3 w-full h-10 border-0 bg-transparent shadow-none text-sm text-gray-500 hover:bg-transparent hover:text-gray-800 dark:hover:text-white">
            {notice.dismiss}
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** One plan card. The featured one is dark, and is the plan being steered towards. */
function OptionCard({ option: o, onChoose }: { option: NoticeOption; onChoose: () => void }) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border-2 p-3.5 sm:p-4 text-left',
        o.featured
          ? 'bg-[#122447] border-[#122447] text-white'
          : 'bg-white border-[#122447] text-gray-900 dark:bg-gray-900 dark:border-gray-300 dark:text-white',
      )}
    >
      <p className={cn('text-[15px] font-semibold leading-snug', o.accent && 'text-orange-400')}>
        {o.label}
        {o.star && <Star className="inline w-4 h-4 ml-1 -mt-0.5 fill-current" aria-hidden />}
      </p>
      <p className="mt-2 text-2xl font-bold">₹{o.price.toLocaleString('en-IN')}</p>
      <p className={cn('text-sm', o.featured ? 'text-white/70' : 'text-gray-500 dark:text-gray-400')}>{o.validity}</p>
      <ul className="mt-3 space-y-1 text-sm flex-1">
        {o.points.map(point => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <AlertDialogAction
        className={cn(
          'mt-4 w-full h-10 rounded-lg px-2 text-[13px] font-semibold',
          // The plan being steered towards has the orange button on the navy card; the other card's button is that navy.
          o.featured ? ORANGE : 'bg-[#122447] text-white hover:bg-[#1c3566] dark:bg-white dark:text-[#122447] dark:hover:bg-gray-200',
        )}
        onClick={onChoose}
      >
        {o.cta}
      </AlertDialogAction>
    </div>
  );
}
