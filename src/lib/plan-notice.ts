/**
 * What to tell someone whose plan stops them taking a test — and the wording is the app's own.
 *
 * The server refuses a start with `403 PLAN_LIMIT_REACHED` (they have used what the plan includes)
 * or `403 PLAN_REQUIRED` (the thing needs a higher plan). Its message used to be shown as it came, as
 * a toast: "Your Free plan includes 2 practice tests a month, and you have used 2. The count resets
 * on the 1st." That is wrong on two counts — limits are not reset, they last as long as the plan is
 * valid — and it says the same thing to everyone.
 *
 * So the app reads the facts out of the error and says it itself, from the person's own plan and the
 * backend's plan data: what they have, what it does not do, and what the next plan up would give them.
 *
 * The facts come from the body when it has them (`limit`, `used`, `kind`, …), and from the server's own
 * sentence when it does not — the sentence is read for its numbers and never shown.
 */
import { TIER_ORDER, type SubscriptionPlanInfo, type SubscriptionTier } from '@/data/userPortalSampleData';
import { perksFor, planCounts } from '@/lib/plans';

/**
 * `ATTEMPTS_USED` is not the plan's doing — a test allows so many attempts and they are spent. The
 * server says it as a bare 400 ("Maximum attempts (3) reached for this assessment"), and the lists
 * show it as a dead "No attempts left". It gets the same popup because the way on is the same: the
 * plans.
 */
export type PlanErrorCode =
  | 'PLAN_LIMIT_REACHED'
  | 'PLAN_REQUIRED'
  | 'ATTEMPTS_USED'
  | 'REPORT_LOCKED'
  | 'SUBSCRIPTION_EXPIRED';
export type TestKind = 'practice' | 'mock';

export interface PlanErrorFacts {
  code: PlanErrorCode;
  /** Which kind of test hit the limit, when the error says. */
  kind: TestKind | null;
  /** How many the plan includes — for ATTEMPTS_USED, how many attempts the test allows. */
  limit: number | null;
  used: number | null;
  /** The plan the blocked thing needs, for PLAN_REQUIRED. */
  requiredTier: SubscriptionTier | null;
  /** What was blocked, for PLAN_REQUIRED ("ai_insights"). */
  feature: string | null;
}

const PLAN_CODES: PlanErrorCode[] = ['PLAN_LIMIT_REACHED', 'PLAN_REQUIRED'];

/** Codes the server might give for spent attempts. It gives none today, so the message is read too. */
const ATTEMPT_CODES = ['MAX_ATTEMPTS_REACHED', 'ATTEMPTS_EXHAUSTED', 'ATTEMPT_LIMIT_REACHED', 'NO_ATTEMPTS_LEFT'];
const ATTEMPT_STATUSES = [400, 403, 409];
const ATTEMPTS_MESSAGE = /maximum attempts|no attempts (?:left|remaining)|attempts? (?:limit )?(?:reached|exhausted)|used all (?:\d+ )?attempts?/i;

/** The facts for an attempts-used popup raised from a screen that already knows — a row, a landing page. */
export const attemptsUsed = (limit: number | null): PlanErrorFacts => ({
  code: 'ATTEMPTS_USED', kind: null, limit, used: limit, requiredTier: null, feature: null,
});

/**
 * A report the plan does not include, raised from a screen that knows it — the server is never asked.
 * On Free that is the mock test report; the practice test report is included.
 */
export const reportLocked = (): PlanErrorFacts => ({
  code: 'REPORT_LOCKED', kind: 'mock', limit: null, used: null, requiredTier: null, feature: null,
});

/**
 * The plan has run out of time, whether or not it ran out of tests. Raised from a screen that knows
 * (see `subscriptionLapsed`), or read off a server refusal that says the subscription is not active.
 */
export const subscriptionExpired = (): PlanErrorFacts => ({
  code: 'SUBSCRIPTION_EXPIRED', kind: null, limit: null, used: null, requiredTier: null, feature: null,
});

/** What the server calls a subscription that is no longer running, in `code` or in `detail.error`. */
const EXPIRED_CODES = ['SUBSCRIPTION_EXPIRED', 'SUBSCRIPTION_INACTIVE', 'PLAN_EXPIRED'];

/**
 * Whether a person's plan has run out of time: the subscription says `expired`, or they are on a paid
 * tier whose end date has passed (the tier can lag the date until the server catches up). A Free plan
 * has no end date and never lapses by itself.
 */
export function subscriptionLapsed(
  tier: string | null | undefined,
  expiry: string | null | undefined,
  status?: string | null,
): boolean {
  if (status === 'expired') return true;
  if (!tier || tier === 'free' || !expiry) return false;
  const d = new Date(expiry);
  // The epoch is the placeholder for "no date".
  return !Number.isNaN(d.getTime()) && d.getFullYear() >= 2001 && d.getTime() < Date.now();
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function firstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = source[key];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return v;
    // `usage: { used: 2 }` — one level down is as far as it goes.
    if (isRecord(v)) {
      const inner = firstNumber(v, ['used', 'count', 'value']);
      if (inner != null) return inner;
    }
  }
  return null;
}

function firstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = source[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

const kindOf = (text: string | null): TestKind | null =>
  text && /mock/i.test(text) ? 'mock' : text && /practice/i.test(text) ? 'practice' : null;

const tierOf = (text: string | null): SubscriptionTier | null => {
  const t = (text ?? '').trim().toLowerCase();
  return (TIER_ORDER as string[]).includes(t) ? (t as SubscriptionTier) : null;
};

/** The facts of a plan refusal or spent attempts, or null for any other error — a level lock, a network failure, anything else. */
export function planErrorFacts(error: unknown): PlanErrorFacts | null {
  if (!isRecord(error) && !(error instanceof Error)) return null;
  const e = error as { code?: unknown; detail?: unknown; message?: unknown; status?: unknown };

  const code = typeof e.code === 'string' ? e.code.toUpperCase() : null;
  const detail = isRecord(e.detail) ? e.detail : {};
  const message = typeof e.message === 'string' ? e.message : '';

  const kindOfError = typeof detail.error === 'string' ? detail.error.toUpperCase() : null;
  if ((code && EXPIRED_CODES.includes(code)) || (kindOfError && EXPIRED_CODES.includes(kindOfError))) {
    return subscriptionExpired();
  }

  if (!code || !PLAN_CODES.includes(code as PlanErrorCode)) {
    // Spent attempts: a code if the server ever sends one, otherwise its sentence on a 4xx that is not a plan refusal.
    const byCode = code != null && ATTEMPT_CODES.includes(code);
    const byMessage = !code && typeof e.status === 'number' && ATTEMPT_STATUSES.includes(e.status) && ATTEMPTS_MESSAGE.test(message);
    if (!byCode && !byMessage) return null;
    return attemptsUsed(
      firstNumber(detail, ['max_attempts', 'limit', 'max', 'allowed']) ??
        numberFrom(message, /\((\d+)\)/) ??
        numberFrom(message, /(\d+)\s+attempts?/i),
    );
  }

  // The body first. The sentence is a fallback for its numbers, and only for those.
  const kind =
    kindOf(firstString(detail, ['kind', 'feature', 'mode', 'test_mode', 'limit_type', 'resource', 'type'])) ?? kindOf(message);
  const limit =
    firstNumber(detail, ['limit', 'max', 'allowed', 'quota', 'included']) ??
    numberFrom(message, /includes?\s+(\d+)/i);
  const used = firstNumber(detail, ['used', 'usage', 'count', 'current']) ?? numberFrom(message, /used\s+(\d+)/i);

  return {
    code: code as PlanErrorCode,
    kind,
    limit,
    used,
    requiredTier:
      code === 'PLAN_REQUIRED' ? tierOf(firstString(detail, ['required_plan', 'required_tier', 'plan_required', 'min_plan', 'min_tier'])) : null,
    feature: code === 'PLAN_REQUIRED' ? firstString(detail, ['feature', 'feature_key', 'capability']) : null,
  };
}

function numberFrom(text: string, pattern: RegExp): number | null {
  const m = pattern.exec(text);
  return m ? Number(m[1]) : null;
}

// ─── The message ──────────────────────────────────────────────────────────────

export type Billing = 'monthly' | 'yearly';
export type NoticeIcon = 'lock' | 'clipboard' | 'graduation' | 'calendar';

/** One of the plan cards at the foot of a popup. */
export interface NoticeOption {
  /** "Monthly Plan", "Renew Annual", "Switch to Monthly" … */
  label: string;
  price: number;
  /** "30 days", "12-month validity". */
  validity: string;
  points: string[];
  /** The card's button. */
  cta: string;
  to: string;
  /** The dark card — the plan being steered towards. */
  featured: boolean;
  /** The label is set in the accent colour. */
  accent: boolean;
  /** A star after the label. */
  star: boolean;
}

/** A line of the little table in a popup — "Mock Tests · 1/1 Used". */
export interface UsageRow {
  label: string;
  value: string;
  /** `used` is set in red, `left` in green. */
  tone: 'used' | 'left';
}

export interface PlanNotice {
  icon: NoticeIcon;
  title: string;
  /** Short paragraphs, in order. `**bold**` marks words to set in bold. */
  body: string[];
  usage: UsageRow[];
  /** Two plan cards with their own buttons; when there are none, `suggestion` and `primary` stand in. */
  options: NoticeOption[];
  /** The plan worth moving to, with what it includes — null when there is nothing higher. */
  suggestion: { name: string; price: number | null; points: string[] } | null;
  primary: { label: string; to: string };
  /** A second way on, for a popup whose first is "upgrade". */
  secondary: { label: string; to: string } | null;
  dismiss: string;
}

export interface PlanNoticeContext {
  /** The person's own plan. */
  current: SubscriptionPlanInfo | null;
  /** The plans on sale. */
  plans: SubscriptionPlanInfo[];
  /** Whether their plan is billed monthly or yearly, when known. Unknown reads as monthly. */
  billing?: Billing | null;
  /** What their plan still allows of each kind; null where unknown or unlimited. */
  left?: { mock: number | null; practice: number | null };
  /** The paid plan they hold or last held — what "Renew" renews. */
  held?: SubscriptionPlanInfo | null;
}

const SUBSCRIPTION = '/user/subscription';
const EXAMS = '/user/exams';

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** How a blocked feature reads in the middle of a sentence. */
const FEATURES: Record<string, string> = {
  ai_insights: 'AI insights',
  report_insights: 'AI insights',
  ai_report: 'AI reports',
  download_pdf: 'PDF download',
  study_plan: 'the study plan',
};

function featureLabel(key: string | null): string | null {
  if (!key) return null;
  return FEATURES[key] ?? key.replace(/[_-]+/g, ' ').trim().toLowerCase();
}

/** What the plan allows of this kind: a number, 0 for "none", null for unlimited or unknown. */
function allowance(plan: SubscriptionPlanInfo | null, kind: TestKind | null): number | null {
  if (!plan || !kind) return null;
  const v = kind === 'mock' ? plan.features.mock_tests_per_month : plan.features.practice_tests_per_month;
  if (v === 'none') return 0;
  return typeof v === 'number' ? v : null;
}

/** The cheapest plan on sale above the one they are on. */
function planAbove(current: SubscriptionPlanInfo | null, plans: SubscriptionPlanInfo[]): SubscriptionPlanInfo | null {
  const here = current ? TIER_ORDER.indexOf(current.tier) : -1;
  return (
    [...plans]
      .filter(p => !p.legacy && p.price_monthly > 0 && TIER_ORDER.indexOf(p.tier) > here)
      .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier))[0] ?? null
  );
}

function suggest(plan: SubscriptionPlanInfo | null): PlanNotice['suggestion'] {
  if (!plan) return null;
  return { name: plan.name, price: plan.price_monthly > 0 ? plan.price_monthly : null, points: perksFor(plan, 'monthly').slice(0, 4) };
}

/**
 * The paid plan the cards are about: the one they hold (to renew it), else the plan that is
 * highlighted, else the next one up. Only a plan that is on sale — a retired one cannot be renewed.
 */
function offerPlan(ctx: PlanNoticeContext): SubscriptionPlanInfo | null {
  const sale = ctx.plans.filter(p => !p.legacy && p.price_monthly > 0);
  const onSale = (p: SubscriptionPlanInfo | null | undefined) => (p ? sale.find(s => s.tier === p.tier) : undefined);
  return onSale(ctx.held) ?? onSale(ctx.current) ?? sale.find(p => p.highlight) ?? planAbove(ctx.current, ctx.plans) ?? sale[0] ?? null;
}

/** How many mock and practice tests a plan includes in a billing cycle — null where the plan data does not say. */
/** The counts the backend gives for the plan in this cycle — never the copy's, so a change on the server shows here. */
function counts(plan: SubscriptionPlanInfo | null, cycle: Billing): { mock: number | null; practice: number | null } {
  if (!plan) return { mock: null, practice: null };
  const c = planCounts(plan, cycle);
  return { mock: c.mock, practice: c.practice };
}

function option(
  plan: SubscriptionPlanInfo,
  cycle: Billing,
  o: { label: string; cta: string; featured?: boolean; accent?: boolean; star?: boolean; longValidity?: boolean; reports?: boolean },
): NoticeOption | null {
  const price = cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
  // A cycle the plan has no price for is not offered.
  if (!(price > 0)) return null;
  const c = counts(plan, cycle);
  const points = [
    ...(c.mock != null ? [plural(c.mock, 'Mock Test')] : []),
    ...(c.practice != null ? [plural(c.practice, 'Practice Test')] : []),
    ...(o.reports ? ['Detailed Reports'] : []),
  ];
  if (points.length === 0) points.push(...perksFor(plan, cycle).slice(0, 3));
  const validity = cycle === 'yearly' ? (o.longValidity ? '12-month validity' : '12 months') : o.longValidity ? '30-day validity' : '30 days';
  return {
    label: o.label,
    price,
    validity,
    points,
    cta: o.cta,
    to: `${SUBSCRIPTION}?billing=${cycle}`,
    featured: !!o.featured,
    accent: !!o.accent,
    star: !!o.star,
  };
}

const present = (list: Array<NoticeOption | null>): NoticeOption[] => list.filter((o): o is NoticeOption => o !== null);

/** Free to paid: the monthly plan beside the annual one, which is the one to take. */
const fromFree = (plan: SubscriptionPlanInfo | null) =>
  plan
    ? present([
        option(plan, 'monthly', { label: 'Monthly Plan', cta: 'Choose Monthly', longValidity: true, reports: true }),
        option(plan, 'yearly', { label: 'Annual Plan', cta: 'Choose Annual', featured: true, accent: true, star: true, longValidity: true, reports: true }),
      ])
    : [];

/** On the monthly plan: renew it, or go annual. */
const fromMonthly = (plan: SubscriptionPlanInfo | null) =>
  plan
    ? present([
        option(plan, 'monthly', { label: 'Renew Monthly', cta: 'Renew Monthly' }),
        option(plan, 'yearly', { label: 'Upgrade to Annual', cta: 'Choose Annual', featured: true, accent: true }),
      ])
    : [];

/** On the annual plan: renew it, or step down to monthly. */
const fromYearly = (plan: SubscriptionPlanInfo | null) =>
  plan
    ? present([
        option(plan, 'yearly', { label: 'Renew Annual', cta: 'Renew Annual', featured: true }),
        option(plan, 'monthly', { label: 'Switch to Monthly', cta: 'Choose Monthly' }),
      ])
    : [];

const VIEW_PLANS = { label: 'View plans', to: SUBSCRIPTION };

/** A popup that is only words and a way to the plans: defaults for everything the caller leaves out. */
function notice(n: Pick<PlanNotice, 'title' | 'body'> & Partial<PlanNotice>): PlanNotice {
  return { icon: 'lock', usage: [], options: [], suggestion: null, primary: VIEW_PLANS, secondary: null, dismiss: 'Maybe Later', ...n };
}

export function composePlanNotice(facts: PlanErrorFacts, ctx: PlanNoticeContext): PlanNotice {
  const { current, plans } = ctx;
  const planName = current?.name ?? 'current';
  const isFree = current?.tier === 'free';
  const onFree = !current || isFree;
  const billing: Billing = ctx.billing ?? 'monthly';
  const above = planAbove(current, plans);

  // ── The plan ran out of time ───────────────────────────────────────────────
  if (facts.code === 'SUBSCRIPTION_EXPIRED') {
    const held = [ctx.held, current].find(p => p && p.tier !== 'free');
    const yours = held ? `Your ${held.name} plan` : 'Your plan';
    const plan = offerPlan(ctx);
    if (billing === 'yearly') {
      return notice({
        icon: 'calendar',
        title: 'Your Subscription Has Expired!',
        body: [
          `${yours} has reached the end of its 12-month validity.`,
          "Your learning journey doesn't have to stop here! Choose a plan to continue taking tests and improving your performance.",
        ],
        options: fromYearly(plan),
      });
    }
    return notice({
      icon: 'calendar',
      title: 'Your Monthly Plan Has Expired!',
      body: [
        "Your 30-day subscription has come to an end, but your preparation journey doesn't have to stop!",
        'Renew your Monthly Plan or upgrade to Annual to continue taking mock tests, practising subjects, and tracking your performance.',
      ],
      options: fromMonthly(plan),
    });
  }

  // ── Something the plan does not include ────────────────────────────────────
  if (facts.code === 'REPORT_LOCKED') {
    // How long the plan the person is on lasts: the backend's own "Validity: …" point when it has one,
    // and for Free — which never expires — the same words if it does not.
    const validity = current?.perks.find(p => /^validity\b/i.test(p)) ?? (isFree ? 'Validity: unlimited' : null);
    return notice({
      title: 'Upgrade to see your report',
      body: ['Upgrade your plan to see the report.', ...(validity ? [`Your ${planName} plan · ${validity}`] : [])],
      suggestion: suggest(above),
      primary: { label: above ? `Upgrade to ${above.name}` : 'View plans', to: SUBSCRIPTION },
      dismiss: above ? 'Not now' : 'Close',
    });
  }

  if (facts.code === 'ATTEMPTS_USED') {
    const first =
      facts.limit != null ? `You've used all ${plural(facts.limit, 'attempt')} on this test.` : `You've used all your attempts on this test.`;
    // What the person can do is take other tests, which is what a plan is for. Nothing here says whether attempts come back.
    const second = isFree
      ? `Upgrade to a paid plan to practise with more tests.`
      : above
        ? `A higher plan unlocks more tests to practise with.`
        : null;
    return notice({
      title: 'No attempts left',
      body: second ? [first, second] : [first],
      suggestion: suggest(above),
      primary: { label: above ? `Upgrade to ${above.name}` : 'View plans', to: SUBSCRIPTION },
      dismiss: above ? 'Not now' : 'Close',
    });
  }

  if (facts.code === 'PLAN_REQUIRED') {
    const needed = facts.requiredTier ? (plans.find(p => p.tier === facts.requiredTier) ?? null) : null;
    const target = needed ?? above;
    const what = featureLabel(facts.feature);
    const first = needed
      ? `You need the ${needed.name} plan${what ? ` for ${what}` : ''} — you're on ${planName}.`
      : `Your ${planName} plan doesn't include ${what ?? 'this'}.`;
    return notice({
      title: needed ? `${needed.name} plan needed` : 'Upgrade needed',
      body: [first],
      suggestion: suggest(target),
      primary: { label: target ? `Upgrade to ${target.name}` : 'View plans', to: SUBSCRIPTION },
      dismiss: 'Not now',
    });
  }

  // ── PLAN_LIMIT_REACHED: the plan has no more tests of this kind ────────────
  const limit = facts.limit ?? allowance(current, facts.kind);
  const practiceLeft = ctx.left?.practice ?? null;

  const plan = offerPlan(ctx);

  // The mock tests are gone but there are practice tests left: say so, and let them carry on. On Free
  // the way on is "upgrade"; on a paid plan it is the same two cards as when everything is used up.
  if (facts.kind === 'mock' && practiceLeft != null && practiceLeft > 0) {
    const first =
      limit === 0
        ? `Mock tests aren't included in your ${planName} plan.`
        : limit === 1
          ? "You've completed the mock test included in your current plan."
          : limit != null
            ? `You've completed all ${limit} mock tests included in your current plan.`
            : "You've completed the mock tests included in your current plan.";
    return notice({
      icon: 'clipboard',
      title: limit === 0 ? 'Mock Tests Not Included' : 'Mock Test Limit Reached!',
      body: [
        first,
        `Good news! You still have **${plural(practiceLeft, 'Subject-wise Practice Test')}** remaining. ${
          onFree ? 'Continue practising or upgrade your plan' : 'Continue practising, or choose a plan below'
        } to unlock more mock tests.`,
      ],
      usage: [
        { label: 'Mock Tests', value: limit === 0 ? 'Not included' : limit != null ? `${facts.used ?? limit}/${limit} Used` : 'All used', tone: 'used' },
        { label: 'Practice Tests', value: `${practiceLeft} Remaining`, tone: 'left' },
      ],
      options: onFree ? [] : billing === 'yearly' ? fromYearly(plan) : fromMonthly(plan),
      primary: { label: 'Upgrade Plan', to: SUBSCRIPTION },
      secondary: { label: 'Continue with Practice Tests', to: EXAMS },
    });
  }

  if (onFree) {
    return notice({
      icon: 'graduation',
      title: 'Ready for the Next Step?',
      body: [
        "You've completed your free test allowance! Keep your preparation going with more mock tests, subject-wise practice, and detailed performance reports.",
      ],
      options: fromFree(plan),
    });
  }

  const c = counts(current, billing);
  const both = c.mock != null && c.practice != null;

  if (billing === 'yearly') {
    return notice({
      icon: 'graduation',
      title: "You've Completed Your Test Allowance!",
      body: [
        both
          ? `You've used all ${plural(c.mock!, 'Mock Test')} and ${plural(c.practice!, 'Subject-wise Practice Test')} included in your ${planName} plan.`
          : `You've used all the tests included in your ${planName} plan.`,
        'Keep your preparation going! Choose a plan to access more tests and continue tracking your progress.',
      ],
      options: fromYearly(plan),
    });
  }

  return notice({
    icon: 'graduation',
    title: 'Keep Your Preparation Going!',
    body: [
      both
        ? `You've completed all ${plural(c.mock!, 'Mock Test')} and ${plural(c.practice!, 'Practice Test')} in your ${planName} plan.`
        : `You've used all the tests included in your ${planName} plan.`,
      "You're making progress! Choose a plan to continue practising and improving your performance.",
    ],
    options: fromMonthly(plan),
  });
}
