/**
 * The words on the plan cards (the landing page) and in the plan popups — the pitch, the "what's
 * included" list, who each plan is for, the button, and how many tests the plan includes.
 *
 * Only words. Names and prices come from the backend (`/user/subscription/plans`), so a price
 * change there shows up on the page without touching this file, and the plans keep the names the
 * backend gives them. The numbers inside the lists ("5 Full-Length Mock Tests") are text and are
 * not read from the plan: when a plan's limits change, change them here too.
 *
 * Keyed by tier, then by billing cycle. A tier with no entry here falls back to the plan's own
 * tagline and perks, so a plan the backend adds still shows up.
 */

export type PlanBilling = 'monthly' | 'yearly';

export interface PlanCopy {
  /** How many mock and practice tests the plan includes, as the copy below says them — the plan popups quote these. */
  mock: number;
  practice: number;
  /** The line under the plan's name — how long the plan lasts. */
  validity: string;
  headline: string;
  blurb: string;
  /** "What's included" — each point is a bold title and the sentence after it. */
  included: Array<[title: string, detail: string]>;
  bestFor: string;
  /** The button. */
  cta: string;
  /** Replaces "Most Popular" on the card's top edge. */
  badge?: string;
}

const FREE: PlanCopy = {
  mock: 1,
  practice: 2,
  validity: 'Lifetime validity',
  headline: 'Start Your Preparation for Free',
  blurb:
    'New to MyGovExams? Explore the platform, experience our testing environment, and take your first step towards smarter exam preparation.',
  included: [
    ['1 Full-Length Mock Test', 'Experience an exam-style test and get familiar with the question format.'],
    ['2 Subject-wise Practice Tests', 'Practice individual subjects and assess your understanding of important concepts.'],
    ['Easy-to-Use Test Interface', 'Get comfortable with the online examination experience.'],
    ['Practice Test Reports', 'Review your practice performance.'],
    ['Detailed Mock Test Report', 'Unlock by upgrading to a paid plan.'],
    ['Lifetime Validity', 'Access your free test allowance without an expiry date.'],
  ],
  bestFor: 'Students who want to explore MyGovExams before purchasing a subscription.',
  cta: 'Get Started for Free',
};

const ULTIMATE_MONTHLY: PlanCopy = {
  mock: 5,
  practice: 25,
  validity: 'Valid for 30 days',
  headline: 'Practice More. Identify Your Weaknesses. Improve Your Scores.',
  blurb:
    'Designed for students who want focused preparation with regular testing and meaningful insights into their performance.',
  included: [
    ['5 Full-Length Mock Tests', 'Assess your exam readiness through complete mock examinations.'],
    ['25 Subject-wise Practice Tests', 'Strengthen individual subjects and focus on areas requiring improvement.'],
    ['Detailed Performance Reports', 'Understand your scores, accuracy, and performance across subjects.'],
    ['Strength & Weakness Analysis', 'Identify areas where you’re performing well and topics that need more attention.'],
    ['Progress Tracking', 'Review your test attempts and monitor your improvement.'],
    ['30-Day Access', 'Complete your available tests during the subscription period.'],
  ],
  bestFor: 'Students preparing for an upcoming exam who want focused practice and regular performance evaluation.',
  cta: 'Choose Monthly Plan',
};

const ULTIMATE_YEARLY: PlanCopy = {
  mock: 30,
  practice: 60,
  validity: 'Valid for 12 months',
  headline: 'Prepare Consistently. Track Your Progress. Stay Exam-Ready.',
  blurb:
    'Our long-term preparation plan is designed for serious aspirants who want to build knowledge, strengthen weaker subjects, and measure their improvement throughout their preparation journey.',
  included: [
    ['30 Full-Length Mock Tests', 'Evaluate your overall exam readiness at different stages of preparation.'],
    ['60 Subject-wise Practice Tests', 'Practice important subjects and reinforce concepts throughout the year.'],
    ['Comprehensive Performance Reports', 'Access detailed insights into test scores, accuracy, and subject-wise performance.'],
    ['Strength & Weakness Analysis', 'Understand which subjects need additional attention.'],
    ['Long-Term Progress Tracking', 'Monitor your performance and improvements across multiple test attempts.'],
    ['12-Month Access', 'Prepare at your own pace with a full year of access to your test allowance.'],
  ],
  bestFor: 'Dedicated aspirants who prefer structured, long-term preparation with regular assessments.',
  cta: 'Choose Annual Plan',
  badge: 'Best value for long-term preparation',
};

export const PLAN_COPY: Record<string, Partial<Record<PlanBilling, PlanCopy>>> = {
  free: { monthly: FREE, yearly: FREE },
  ultimate: { monthly: ULTIMATE_MONTHLY, yearly: ULTIMATE_YEARLY },
};
