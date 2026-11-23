/**
 * The admin's plan form: turning a plan's card text into something a form can edit, and back.
 *
 * The card is what an aspirant reads on the pricing page — headline, blurb, the "what's included" list, who
 * the plan is for, and the button. One card per billing cycle. Everything here is plain data in / data out so
 * the form stays thin and the rules (what counts as "blank", what is sent) are tested in one place.
 */
import type { PlanCardsWire, PlanCardWire, PlanName } from '@/lib/adminApi';

export type CardCycle = 'monthly' | 'yearly';

export const CARD_LIMITS = {
  tagline: 120,
  headline: 120,
  description: 300,
  includedTitle: 80,
  includedDetail: 200,
  includedItems: 12,
  excludedItem: 120,
  excludedItems: 8,
  bestFor: 200,
  cta: 40,
  badge: 60,
} as const;

/** One billing cycle's card as the form holds it: text fields, and the "not included" list as one line each. */
export interface PlanCardForm {
  headline: string;
  description: string;
  included: Array<{ title: string; detail: string }>;
  /** One per line. */
  excluded: string;
  best_for: string;
  cta: string;
  badge: string;
}

export const emptyCardForm = (): PlanCardForm => ({
  headline: '',
  description: '',
  included: [],
  excluded: '',
  best_for: '',
  cta: '',
  badge: '',
});

export function cardToForm(card: PlanCardWire | null | undefined): PlanCardForm {
  if (!card) return emptyCardForm();
  return {
    headline: card.headline ?? '',
    description: card.description ?? '',
    included: (card.included ?? []).map(i => ({ title: i.title ?? '', detail: i.detail ?? '' })),
    excluded: (card.excluded ?? []).join('\n'),
    best_for: card.best_for ?? '',
    cta: card.cta ?? '',
    badge: card.badge ?? '',
  };
}

const blank = (s: string) => s.trim() === '';
const orNull = (s: string) => (blank(s) ? null : s.trim());

/** True when the admin has written nothing on the card — it is then not sent, and the bundled wording is used. */
export function isCardBlank(f: PlanCardForm): boolean {
  return (
    blank(f.headline) &&
    blank(f.description) &&
    blank(f.best_for) &&
    blank(f.cta) &&
    blank(f.badge) &&
    blank(f.excluded) &&
    f.included.every(i => blank(i.title) && blank(i.detail))
  );
}

/** The card as it is sent: blanks become null, a point with no title is dropped, "not included" is split by line. */
export function cardFromForm(f: PlanCardForm): PlanCardWire | null {
  if (isCardBlank(f)) return null;
  return {
    headline: orNull(f.headline),
    description: orNull(f.description),
    included: f.included.filter(i => !blank(i.title)).map(i => ({ title: i.title.trim(), detail: orNull(i.detail) })),
    excluded: f.excluded
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean),
    best_for: orNull(f.best_for),
    cta: orNull(f.cta),
    badge: orNull(f.badge),
  };
}

export function cardsToWire(monthly: PlanCardForm, yearly: PlanCardForm): PlanCardsWire | null {
  const m = cardFromForm(monthly);
  const y = cardFromForm(yearly);
  return m || y ? { monthly: m, yearly: y } : null;
}

/** What is wrong with a card's text, or null. The first problem only — the form shows one line. */
export function cardProblem(f: PlanCardForm, cycle: CardCycle): string | null {
  const where = cycle === 'monthly' ? 'Monthly card' : 'Yearly card';
  if (f.headline.length > CARD_LIMITS.headline) return `${where}: headline is over ${CARD_LIMITS.headline} characters.`;
  if (f.description.length > CARD_LIMITS.description) return `${where}: description is over ${CARD_LIMITS.description} characters.`;
  if (f.best_for.length > CARD_LIMITS.bestFor) return `${where}: "Best for" is over ${CARD_LIMITS.bestFor} characters.`;
  if (f.cta.length > CARD_LIMITS.cta) return `${where}: button text is over ${CARD_LIMITS.cta} characters.`;
  if (f.badge.length > CARD_LIMITS.badge) return `${where}: badge is over ${CARD_LIMITS.badge} characters.`;
  if (f.included.length > CARD_LIMITS.includedItems) return `${where}: at most ${CARD_LIMITS.includedItems} included points.`;
  if (f.included.some(i => i.title.length > CARD_LIMITS.includedTitle || i.detail.length > CARD_LIMITS.includedDetail)) {
    return `${where}: an included point is too long (title ${CARD_LIMITS.includedTitle}, detail ${CARD_LIMITS.includedDetail}).`;
  }
  const excluded = f.excluded.split('\n').filter(s => s.trim());
  if (excluded.length > CARD_LIMITS.excludedItems) return `${where}: at most ${CARD_LIMITS.excludedItems} "not included" lines.`;
  if (excluded.some(s => s.trim().length > CARD_LIMITS.excludedItem)) return `${where}: a "not included" line is over ${CARD_LIMITS.excludedItem} characters.`;
  return null;
}

/**
 * What a brand-new plan starts with, so the admin edits words rather than types them. Numbers are not in
 * the words: the points use {mock} / {practice} placeholders that are filled from the plan's own counts.
 */
export interface PlanStarter {
  tagline: string;
  price_monthly: number;
  price_yearly: number;
  mock: number | 'unlimited' | 'none';
  practice: number | 'unlimited';
  ai_report_level: 'basic' | 'standard' | 'detailed' | 'full';
  history_retention_days: number | 'unlimited';
  perks: string[];
  monthly: PlanCardForm;
}

export const PLAN_STARTERS: Partial<Record<PlanName, PlanStarter>> = {
  essential: {
    tagline: 'Start small. Practise smart. Improve every day.',
    price_monthly: 149,
    price_yearly: 0,
    mock: 1,
    practice: 15,
    ai_report_level: 'standard',
    history_retention_days: 90,
    perks: ['1 full-length mock test', '15 subject-wise practice tests', 'Detailed performance reports', 'Strength & weakness analysis', 'Top-up anytime'],
    monthly: {
      headline: 'Start Small. Practise Smart. Improve Every Day.',
      description:
        'An affordable way to begin your government exam preparation with regular practice and detailed performance insights.',
      included: [
        { title: '{mock} Full-Length Mock Test{mock_s}', detail: 'Evaluate your exam readiness with a timed test following the relevant examination pattern.' },
        { title: '{practice} Subject-wise Practice Test{practice_s}', detail: 'Strengthen your understanding of important subjects and practise topics that need attention.' },
        { title: 'Detailed Performance Reports', detail: 'Access comprehensive insights into your test scores, accuracy and subject-wise performance.' },
        { title: 'Strength & Weakness Analysis', detail: 'Identify your strong areas and understand which subjects need more attention.' },
        { title: 'Progress Tracking', detail: 'Review your attempts and monitor your improvement over time.' },
        { title: 'Top-up Anytime', detail: 'Purchase additional mock tests or practice tests whenever you need them.' },
      ],
      excluded: '',
      best_for: 'Beginners and budget-conscious aspirants who want to start practising, evaluate their preparation and improve consistently.',
      cta: 'Choose Essential',
      badge: '',
    },
  },
};
