/**
 * The words on the plan cards (the landing page) and in the plan popups — the pitch, the "what's
 * included" list, who each plan is for, and the button.
 *
 * Only words. Every number in them comes from the backend's plan data (`/user/subscription/plans`):
 * the test counts, how long a plan lasts, the price. The "what's included" titles are templates, so
 * "{mock} Full-Length Mock Test{mock_s}" reads "5 Full-Length Mock Tests" for the plan the server says
 * has five. A count the server does not give drops its line rather than showing a number from here.
 *
 * Keyed by tier, then by billing cycle. A tier with no entry here falls back to the plan's own
 * tagline and perks, so a plan the backend adds still shows up.
 */
import type { PlanCard, SubscriptionPlanInfo } from '@/data/userPortalSampleData';
import { planCounts, validityLabel } from '@/lib/plans';

export type PlanBilling = 'monthly' | 'yearly';

export interface PlanCopy {
  headline: string;
  blurb: string;
  /**
   * "What's included" — each point is a bold title and the sentence after it. The titles use the
   * placeholders {mock}, {mock_s}, {practice} and {practice_s}, filled from the plan's counts.
   */
  included: Array<[title: string, detail: string]>;
  bestFor: string;
  /** Things the plan does not include, shown greyed out under the list. */
  excluded?: string[];
  /** The button. */
  cta: string;
  /** Replaces "Most Popular" on the card's top edge. */
  badge?: string;
}

const FREE: PlanCopy = {
  headline: 'Start Your Preparation for Free',
  blurb: 'New to MyGovExams? Try the platform and take your first step towards smarter exam preparation.',
  included: [
    ['{mock} Full-Length Mock Test{mock_s}', 'Experience an exam-style test and get familiar with the question format.'],
    ['{practice} Subject-wise Practice Test{practice_s}', 'Practice individual subjects and assess your understanding of important concepts.'],
    ['Easy-to-use test interface', 'Get comfortable with the online examination experience.'],
    ['Practice test reports', 'Review your practice performance.'],
  ],
  excluded: ['Detailed mock test report — paid plans only', 'Top-ups not available on Free'],
  bestFor: 'Students who want to explore MyGovExams before purchasing a subscription.',
  cta: 'Get Started for Free',
};

const ULTIMATE_MONTHLY: PlanCopy = {
  headline: 'Practice More. Identify Your Weaknesses. Improve Your Scores.',
  blurb: 'For focused preparation with regular testing and clear insights into your performance.',
  included: [
    ['{mock} Full-Length Mock Test{mock_s}', 'Assess your exam readiness through complete mock examinations.'],
    ['{practice} Subject-wise Practice Test{practice_s}', 'Strengthen individual subjects and focus on areas requiring improvement.'],
    ['Detailed performance reports', 'Understand your scores, accuracy, and performance across subjects.'],
    ['Strength & weakness analysis', 'Identify areas where you’re performing well and topics that need more attention.'],
    ['Progress tracking', 'Review your test attempts and monitor your improvement.'],
    ['Can add top-ups any time', 'Buy extra tests whenever you need them.'],
  ],
  bestFor: 'Students preparing for an upcoming exam who want focused practice and regular performance evaluation.',
  cta: 'Choose Monthly Plan',
};

const ULTIMATE_YEARLY: PlanCopy = {
  headline: 'Prepare Consistently. Track Your Progress. Stay Exam-Ready.',
  blurb: 'For serious aspirants who want to build knowledge, strengthen weak subjects and track improvement all year.',
  included: [
    ['{mock} Full-Length Mock Test{mock_s}', 'Evaluate your overall exam readiness at different stages of preparation.'],
    ['{practice} Subject-wise Practice Test{practice_s}', 'Practice important subjects and reinforce concepts throughout the year.'],
    ['Comprehensive performance reports', 'Access detailed insights into test scores, accuracy, and subject-wise performance.'],
    ['Strength & weakness analysis', 'Understand which subjects need additional attention.'],
    ['Progress tracking all year', 'Monitor your performance and improvements across multiple test attempts.'],
    ['Can add top-ups any time', 'Buy extra tests whenever you need them.'],
  ],
  bestFor: 'Dedicated aspirants who prefer structured, long-term preparation with regular assessments.',
  cta: 'Choose Annual Plan',
  badge: 'Best value for long-term preparation',
};

export const PLAN_COPY: Record<string, Partial<Record<PlanBilling, PlanCopy>>> = {
  free: { monthly: FREE, yearly: FREE },
  ultimate: { monthly: ULTIMATE_MONTHLY, yearly: ULTIMATE_YEARLY },
};

/** One "what's included" point: a title and the sentence after it. */
export type IncludedPoint = [title: string, detail: string];

/**
 * The "what's included" points for a plan in a billing cycle, with the counts the backend gives.
 *
 * A point whose count the server does not send is left out, so a figure is never shown that the
 * plan data does not carry.
 */
export function includedFor(copy: PlanCopy, plan: SubscriptionPlanInfo, billing: PlanBilling): IncludedPoint[] {
  const c = planCounts(plan, billing);
  const fill = (text: string) =>
    text
      .replace(/\{mock_s\}/g, c.mock === 1 ? '' : 's')
      .replace(/\{practice_s\}/g, c.practice === 1 ? '' : 's')
      .replace(/\{mock\}/g, c.mockText)
      .replace(/\{practice\}/g, c.practiceText);
  return copy.included
    .filter(([title]) => !(title.includes('{mock}') && c.mock === null) && !(title.includes('{practice}') && c.practice === null))
    .map(([title, detail]) => [fill(title), detail] as IncludedPoint);
}

/** The line under a plan's name, from the backend's validity — null when it does not say. */
export function validityFor(plan: SubscriptionPlanInfo, billing: PlanBilling): string | null {
  return validityLabel(plan, billing);
}

/**
 * The words for a plan's card in a billing cycle: the backend's own, when it sends them; otherwise the
 * bundled wording, with its counts filled from the plan. Null when neither has anything for the card.
 */
export function cardFor(plan: SubscriptionPlanInfo, billing: PlanBilling): PlanCard | null {
  const cycle = cycleShown(plan, billing);
  const fromApi = plan.cards?.[cycle];
  if (fromApi) return fromApi;
  const copy = PLAN_COPY[plan.tier]?.[cycle];
  if (!copy) return null;
  return {
    headline: copy.headline,
    description: copy.blurb,
    included: includedFor(copy, plan, cycle).map(([title, detail]) => ({ title, detail })),
    excluded: copy.excluded ?? [],
    best_for: copy.bestFor,
    cta: copy.cta,
    badge: copy.badge ?? null,
  };
}

/**
 * The billing cycle a plan's card is really showing. Yearly was asked for, but a paid plan with no
 * yearly price keeps showing its monthly one rather than ₹0; a free plan reads the same either way.
 * The landing page and the Subscription page both pick a card's copy with this, so they agree.
 */
export function cycleShown(plan: { price_monthly: number; price_yearly: number }, billing: PlanBilling): PlanBilling {
  const free = plan.price_monthly === 0;
  return billing === 'yearly' && (free || plan.price_yearly > 0) ? 'yearly' : 'monthly';
}
