/**
 * MyGovExams — the public landing page, served at `/`.
 *
 * The layout follows the supplied mockup (a full-width page: photo hero, a stats band, a
 * five-column feature card, the "currently available" banner, how-it-works with four
 * product previews, plans, and a closing call to action). See `landing.css` for how its
 * stylesheet is scoped to live inside this app. What is different from the mockup, on
 * purpose:
 *
 *  - Links go to this app's routes (`/user/login`, `/user/register`).
 *  - The pricing cards are the plans the backend actually sells
 *    (`GET /api/v1/user/subscription/plans`, the same source the Subscription page reads),
 *    not the mockup's "Free Trial / Monthly / 3 Months" copy — a landing page that quotes
 *    limits the product does not enforce is the failure PLANS.md exists to prevent. There is
 *    no bundled fallback here: if the request fails the section says so and offers a retry,
 *    rather than quoting a price the backend may not charge.
 *  - In-page links scroll instead of using `#anchors`, which a HashRouter would read as a
 *    route.
 *  - The report and study-plan previews are drawings, not data, and say so.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ChevronDown,
  Clock,
  Crown,
  FileText,
  Gem,
  Gift,
  Landmark,
  Database,
  Rocket,
  Shuffle,
  Sparkles,
  Target,
  Trophy,
  Eye,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { publicApi } from '@/lib/api';
import { costPerMonth, offeredPlans, perksFor, plansFromApi, yearlySavings } from '@/lib/plans';
import { cardFor, cycleShown } from '@/lib/plan-copy';
import { topUpPacksFrom, type TopUpPack } from '@/lib/topup-api';
import { useLiveExams } from '@/hooks/use-live-exams';
import { joinExamNames } from '@/config/landing-settings';
import { Rich, useT } from '@/content';
import type { ContentKey } from '@/content/registry';
import { AnnounceIcon, ChooseTestIcon, PlanIcon, PracticeIcon, ReportIcon, type LandingIcon } from './LandingIcons';
import { ButtonLink, LandingFooter, LandingHeader, ROUTES, SectionLink, scrollToSection } from './LandingShell';
import './landing.css';

/** Where the page's artwork lives — `public/landing/`, so it can be swapped without a build. */

const ART = `${import.meta.env.BASE_URL}landing/`;

// Update these when the claim or the routes change.
const CONFIG = {
  /**
   * Display claims, taken from the mockup. They are the business's to confirm — none of
   * them is measured by this app — so confirm each before this goes public.
   */
  loginPath: ROUTES.login,
  signupPath: ROUTES.signup,
};

const heroChecks: ContentKey[] = ['landing.hero.check1', 'landing.hero.check2', 'landing.hero.check3', 'landing.hero.check4'];

/** The "Powered by AI" cards. `tone` picks the tint of the icon circle. */
const features: Array<{ icon: LucideIcon; title: ContentKey; desc: ContentKey; tone: string; soon?: boolean }> = [
  { icon: ClipboardList, title: 'landing.features.1.title', desc: 'landing.features.1.desc', tone: 'blue' },
  { icon: Target, title: 'landing.features.2.title', desc: 'landing.features.2.desc', tone: 'pink' },
  { icon: BookOpen, title: 'landing.features.3.title', desc: 'landing.features.3.desc', tone: 'purple' },
  { icon: BarChart3, title: 'landing.features.4.title', desc: 'landing.features.4.desc', tone: 'green' },
  { icon: CalendarDays, title: 'landing.features.5.title', desc: 'landing.features.5.desc', tone: 'rose' },
];

const steps: Array<{ name: ContentKey; desc: ContentKey; icon: LandingIcon; soon?: boolean }> = [
  { name: 'landing.how.1.name', desc: 'landing.how.1.desc', icon: ChooseTestIcon },
  { name: 'landing.how.2.name', desc: 'landing.how.2.desc', icon: PracticeIcon },
  { name: 'landing.how.3.name', desc: 'landing.how.3.desc', icon: ReportIcon },
  { name: 'landing.how.4.name', desc: 'landing.how.4.desc', icon: PlanIcon },
];

function Hero() {
  const t = useT();
  const liveExams = useLiveExams(); // the admin's list (Admin Settings → Site content)
  return (
    <section id="home" className="mge-hero">
      <div className="mge-container mge-hero-grid">
        <div className="mge-hero-copy">
          <div className="mge-eyebrow mge-eyebrow-ai">
            <Sparkles size={14} aria-hidden="true" />
            {t('landing.hero.eyebrow')}
          </div>
          <h1>
            <Rich text={t('landing.hero.title')} />{' '}
            {/* Which exams are open today — a sticker that floats beside the last line. (No <span>s
                inside it: the heading's own `span` rule would colour them orange.) */}
            <span className="mge-live-chip">
              <em>
                <i aria-hidden="true" />
                {t('landing.hero.live')}
              </em>
              {/* One exam a line, so another can be added without the sticker wrapping at random. */}
              <strong className="mge-live-exams">
                {liveExams.map(name => (
                  <b key={name}>{name}</b>
                ))}
              </strong>
            </span>
          </h1>
          <p className="mge-lead">
            {/* "AI-powered" never breaks across lines. */}
            {t('landing.hero.lead')
              .split(/(AI-powered)/)
              .map((part, i) => (part === 'AI-powered' ? <span key={i} className="mge-nowrap">{part}</span> : part))}
          </p>
          <div className="mge-hero-actions">
            <ButtonLink to={CONFIG.signupPath}>
              {t('landing.nav.cta')} <ArrowRight size={19} />
            </ButtonLink>
            {/* Phones only: the header's Login is behind the menu button there. */}
            <ButtonLink to={CONFIG.loginPath} secondary className="mge-hero-login">
              {t('landing.nav.login')}
            </ButtonLink>
            <SectionLink to="pricing" className="mge-btn mge-btn-secondary">
              {t('landing.hero.plans')}
            </SectionLink>
          </div>
          <div className="mge-checks">
            {heroChecks.map(c => (
              <span key={c}>
                <CheckCircle2 /> {t(c)}
              </span>
            ))}
          </div>
        </div>
        <div className="mge-hero-art">
          <img src={`${ART}hero.png`} alt="A student preparing for her government exam" />
          {/* Live text on the artwork, not painted into it: crisp at any size, and editable. */}
          <p className="mge-art-note">
            <Rich text={t('landing.hero.note')} />
          </p>
          <div className="mge-art-badge">
            <Trophy size={18} aria-hidden="true" />
            {t('landing.hero.badge')}
          </div>
        </div>
      </div>
    </section>
  );
}

/** The "new questions every attempt" promise, with the four things it means. */
function FreshAttempts() {
  const t = useT();
  const points: Array<{ icon: LucideIcon; title: ContentKey; tone: string }> = [
    { icon: Shuffle, title: 'landing.fresh.p1', tone: 'blue' },
    { icon: BarChart3, title: 'landing.fresh.p2', tone: 'sky' },
    { icon: FileText, title: 'landing.fresh.p3', tone: 'purple' },
    { icon: Target, title: 'landing.fresh.p4', tone: 'rose' },
  ];
  return (
    <section className="mge-container">
      <div className="mge-fresh">
        <div className="mge-fresh-head">
          <span className="mge-fresh-icon">
            <Shuffle size={34} aria-hidden="true" />
          </span>
          <div>
            <h2>
              <em>{t('landing.fresh.tag')}</em> {t('landing.fresh.title')}
            </h2>
            <p>{t('landing.fresh.desc')}</p>
          </div>
        </div>
        <ul className="mge-fresh-points">
          {points.map(p => (
            <li key={p.title}>
              <span className={`mge-stat-icon mge-tone-${p.tone}`}>
                <p.icon size={24} aria-hidden="true" />
              </span>
              {t(p.title)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Stats() {
  const t = useT();
  // The same figures as the Exams page (`site.stats.*`), so the two never disagree.
  const items: Array<{ icon: LucideIcon; value: string; label: string; sub?: string; levels?: boolean; tone: string }> = [
    { icon: Database, value: t('site.stats.questions'), label: t('landing.stats.questions.label'), sub: t('landing.stats.questions.sub'), levels: true, tone: 'blue' },
    { icon: Users, value: t('site.stats.aspirants'), label: t('landing.stats.aspirants.label'), sub: t('landing.stats.aspirants.sub'), tone: 'purple' },
    { icon: FileText, value: t('site.stats.newQuestions'), label: t('landing.stats.new.label'), sub: t('landing.stats.new.sub'), tone: 'sky' },
    { icon: Landmark, value: t('landing.stats.focus.value'), label: t('landing.stats.focus.label'), tone: 'green' },
  ];
  return (
    <section className="mge-container">
      <div className="mge-stats">
        {items.map(s => (
          <div key={s.label}>
            <span className={`mge-stat-icon mge-tone-${s.tone}`}>
              <s.icon size={34} />
            </span>
            <div>
              <strong>{s.value}</strong>
              <span className={s.sub ? 'mge-stat-label' : undefined}>{s.label}</span>
              {s.sub && <span>{s.sub}</span>}
              {s.levels && (
                <div className="mge-stat-levels">
                  <span className="mge-lv-simple">Simple</span>
                  <span className="mge-lv-medium">Medium</span>
                  <span className="mge-lv-complex">Complex</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  const t = useT();
  return (
    <section className="mge-container mge-ai-section" aria-labelledby="mge-ai-title">
      <div className="mge-ai-heading">
        <h2 id="mge-ai-title">
          <Rich text={t('landing.features.title')} />
        </h2>
        <p>{t('landing.features.lead')}</p>
      </div>
      <div className="mge-ai-grid">
        {features.map(f => (
          <article className="mge-ai-card" key={f.title}>
            <div className="mge-ai-card-head">
              <span className={`mge-ai-icon mge-ai-${f.tone}`}>
                <f.icon size={26} aria-hidden="true" />
              </span>
              <h3>
                {t(f.title)}
                {f.soon && <em className="mge-soon-tag">Coming soon</em>}
              </h3>
            </div>
            <p>{t(f.desc)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExamBanner() {
  const t = useT();
  const [first, ...rest] = useLiveExams();
  return (
    <section className="mge-container">
      <div className="mge-exam-banner">
        <div className="mge-exam-copy">
          <span className="mge-kicker">{t('landing.banner.kicker')}</span>
          <h2>
            {first}
            {rest.map((name, i) => (
              <small key={name}>
                {name}
                {i < rest.length - 1 ? ',' : ''}
              </small>
            ))}
          </h2>
          <p>{t('landing.banner.desc')}</p>
        </div>
        {/* One scene for the exams: the TNPSC building, the RRB train in front of it, and the bank (labelled "Soon"). */}
        <div className="mge-exam-art">
          <img className="mge-exam-scene" src={`${ART}exams-scene.svg`} alt="" aria-hidden />
        </div>
        <div className="mge-soon">
          <AnnounceIcon size={52} />
          <div>
            <strong>{t('landing.banner.soon.title')}</strong>
            <p>{t('landing.banner.soon.desc')}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The four product previews under the steps. Drawings, not data. */
function DemoCards() {
  const t = useT();
  return (
    <div className="mge-demo-grid">
      <figure>
        <div className="mge-demo-card">
          <h4>Mock Test Experience</h4>
          <div className="mge-q-head">
            <span>Q. 12/100</span>
            <span>
              <Clock size={12} /> 01:30:00
            </span>
          </div>
          <p className="mge-q-text">Which of the following is the longest river in India?</p>
          {['Godavari', 'Krishna', 'Ganga', 'Narmada'].map(o => (
            <div key={o} className={o === 'Ganga' ? 'mge-opt mge-opt-on' : 'mge-opt'}>
              <i /> {o}
            </div>
          ))}
          <div className="mge-q-next">
            Next Question <ArrowRight size={12} />
          </div>
        </div>
        <figcaption>{t('landing.how.demo1')}</figcaption>
      </figure>

      <figure>
        <div className="mge-demo-card">
          <h4>Unit-wise Practice</h4>
          <div className="mge-select">
            Part A - Tamil <ChevronDown size={14} />
          </div>
          <div className="mge-select">
            Unit 1 - இலக்கணம் <ChevronDown size={14} />
          </div>
          {['Simple', 'Medium', 'Complex'].map((v, i) => (
            <div className={`mge-difficulty mge-d${i}`} key={v}>
              <span>
                <b />
                {v}
              </span>
              <ArrowRight size={15} />
            </div>
          ))}
        </div>
        <figcaption>{t('landing.how.demo2')}</figcaption>
      </figure>

      <figure>
        <div className="mge-demo-card">
          <h4>
            AI Performance Report <em>sample</em>
          </h4>
          <div className="mge-score-row">
            <div className="mge-donut">
              <span>72%</span>
            </div>
            <div className="mge-legend">
              <span>
                Correct <b>72</b>
              </span>
              <span className="mge-bad">
                Incorrect <b>18</b>
              </span>
              <span>
                Not Attempted <b>10</b>
              </span>
            </div>
          </div>
          <h5>Subject-wise Performance</h5>
          {[
            ['Tamil', 80, ''],
            ['General Studies', 65, 'mge-orange-bar'],
            ['Aptitude', 55, 'mge-orange-bar'],
          ].map(([name, pct, cls]) => (
            <div className="mge-bar-line" key={name as string}>
              <span>{name}</span>
              <div className={`mge-bar ${cls}`}>
                <i style={{ width: `${pct}%` }} />
              </div>
              <b>{pct}%</b>
            </div>
          ))}
        </div>
        <figcaption>{t('landing.how.demo3')}</figcaption>
      </figure>

      <figure>
        <div className="mge-demo-card">
          <h4>
            Personalized Study Plan
          </h4>
          <h5 className="mge-plan-title">Your 4-Week Study Plan</h5>
          {(
            [
              [Target, 'Focus on weak topics', 'red'],
              [FileText, 'Recommended practice tests', 'purple'],
              [CalendarDays, 'Daily study plan', 'violet'],
              [BarChart3, 'Track your improvement', 'blue'],
            ] as Array<[LucideIcon, string, string]>
          ).map(([Icon, text, tone]) => (
            <div className="mge-plan-line" key={text}>
              <span className={`mge-plan-icon mge-tone-${tone}`}>
                <Icon size={15} />
              </span>
              {text}
            </div>
          ))}
        </div>
        <figcaption>{t('landing.how.demo4')}</figcaption>
      </figure>
    </div>
  );
}

function HowItWorks() {
  const t = useT();
  return (
    <section className="mge-container mge-section" id="how-it-works">
      <div className="mge-section-heading mge-left">
        <h2>{t('landing.how.title')}</h2>
        <p>{t('landing.how.lead')}</p>
      </div>
      <div className="mge-steps">
        {steps.map((s, i) => (
          <div className="mge-step" key={s.name}>
            <div className="mge-step-top">
              <span className={`mge-step-number mge-step-${i}`}>{i + 1}</span>
              <span className={`mge-step-icon mge-step-icon-${i}`}>
                <s.icon size={40} />
              </span>
              {i < 3 && <ArrowRight className="mge-step-arrow" size={22} />}
            </div>
            <h3>
              {t(s.name)}
              {s.soon && <em className="mge-soon-tag">Coming soon</em>}
            </h3>
            <p>{t(s.desc)}</p>
          </div>
        ))}
      </div>
      <DemoCards />
    </section>
  );
}

// ─── Pricing ────────────────────────────────────────────────────────────────────

/**
 * The plans the landing page offers: exactly what the Subscription page offers, from the same
 * backend data and by the same rule (`offeredPlans`), in ladder order.
 *
 * Nothing is filled in from a bundled copy. A sales page quoting a price the backend does not
 * charge is worse than one that says it could not load them — the bundled prices have drifted from
 * the real ones before (see `lib/plans.ts`) — so a failed read shows a message and a retry.
 */
function useLandingPlans() {
  const q = useQuery({
    queryKey: ['landing', 'plans'],
    // The no-auth client: a visitor has no session, and a failed read here must not send
    // them to a login page.
    queryFn: async () => plansFromApi(await publicApi.get<unknown>('/api/v1/user/subscription/plans')),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const plans = offeredPlans(q.data ?? []);
  return {
    plans,
    loading: q.isLoading,
    // An empty answer is as useless to a visitor as an error: there is nothing to choose between.
    failed: q.isError || (q.isSuccess && plans.length === 0),
    retry: () => void q.refetch(),
  };
}

/**
 * The line under the cards. Monthly: how the limits are counted, and what the plans' own prices say a
 * year saves (or nothing about it). Yearly: the cards already show the year's limits and price.
 */
function pricingNote(billing: Billing, savings: { min: number; max: number } | null): string {
  if (billing === 'yearly') return 'Yearly plans are paid once for the full year.';
  const counted = 'Limits are counted per month.';
  if (!savings) return counted;
  const how = savings.min === savings.max ? `about ${savings.max}%` : `up to ${savings.max}%`;
  return `${counted} Choose Yearly to pay ${how} less.`;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

type Billing = 'monthly' | 'yearly';

/**
 * The top-up packs, read from the packs endpoint. A visitor has no session, so when the server will not
 * answer them the section is simply left out rather than showing prices it did not give.
 */
function TopUps() {
  const t = useT();
  const { data } = useQuery({
    queryKey: ['landing', 'topup-packs'],
    queryFn: async () => topUpPacksFrom(await publicApi.get<unknown>('/api/v1/user/topup/packs')),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  if (!data || data.packs.length === 0) return null;
  const contents = (p: TopUpPack) =>
    p.mock > 0 && p.practice > 0
      ? `${p.mock} Mock + ${p.practice} Practice Tests`
      : p.mock > 0
        ? `${p.mock} Mock Test${p.mock === 1 ? '' : 's'}`
        : `${p.practice} Practice Test${p.practice === 1 ? '' : 's'}`;
  const columns = [
    { title: 'Combo packs', packs: data.packs.filter(p => p.mock > 0 && p.practice > 0) },
    { title: 'Mock test packs', packs: data.packs.filter(p => p.mock > 0 && p.practice === 0) },
    { title: 'Practice test packs', packs: data.packs.filter(p => p.practice > 0 && p.mock === 0) },
  ].filter(c => c.packs.length > 0);
  return (
    <div className="mge-topups">
      <h3>{t('landing.topups.title')}</h3>
      <p>{t('landing.topups.desc')}</p>
      <div className="mge-topup-cols">
        {columns.map(col => (
          <div key={col.title}>
            <h4>{col.title}</h4>
            {col.packs.map(pack => (
              <div className="mge-topup-card" key={pack.pack_id}>
                <div>
                  <strong>{pack.name}</strong>
                  <span>{contents(pack)}</span>
                </div>
                <div className="mge-topup-price">
                  {rupees(pack.price)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Pricing() {
  const t = useT();
  const { plans, loading, failed, retry } = useLandingPlans();
  const savings = yearlySavings(plans);
  // The same cards the Subscription page shows: Free, then each paid plan monthly and yearly — nothing to toggle.
  const cards: Array<{ plan: (typeof plans)[number]; billing: Billing }> = [
    ...plans.filter(p => p.price_monthly === 0).map(plan => ({ plan, billing: 'monthly' as Billing })),
    ...plans
      .filter(p => p.price_monthly > 0)
      .flatMap(plan => [
        { plan, billing: 'monthly' as Billing },
        ...(plan.price_yearly > 0 ? [{ plan, billing: 'yearly' as Billing }] : []),
      ]),
  ];
  return (
    <section className="mge-pricing-section" id="pricing">
      <div className="mge-container">
        <div className="mge-section-heading">
          <h2>{t('landing.pricing.title')}</h2>
          <p>{t('landing.pricing.lead')}</p>
        </div>
        {loading && (
          <div className="mge-pricing-grid" aria-busy="true" aria-label="Loading plans">
            {[0, 1, 2].map(i => (
              <div className="mge-price-card mge-price-skeleton" key={i} />
            ))}
          </div>
        )}
        {failed && !loading && (
          <div className="mge-pricing-error" role="status">
            <p>{t('landing.pricing.error')}</p>
            <button type="button" className="mge-btn mge-btn-secondary" onClick={retry}>
              Try again
            </button>
          </div>
        )}
        <div className={cards.length >= 4 ? 'mge-pricing-grid mge-pricing-grid-4' : 'mge-pricing-grid'}>
          {cards.map(({ plan: p, billing }) => {
            const free = p.price_monthly === 0;
            // The yearly card of a plan whose year costs less than twelve months is the one to take.
            const popular = billing === 'yearly' && p.price_yearly < p.price_monthly * 12;
            const Icon = popular ? Crown : free ? Gift : Gem;
            const cycle: Billing = cycleShown(p, billing);
            const copy = cardFor(p, billing);
            const monthlyCost = costPerMonth(p, cycle);
            const saving = p.price_monthly * 12 - p.price_yearly;
            const months = p.duration_days_yearly ? Math.round(p.duration_days_yearly / 30) : null;
            const priceOfMonths = p.price_monthly > 0 ? Math.round(p.price_yearly / p.price_monthly) : null;
            const badge =
              popular && months && priceOfMonths ? `Best Value · ${months} Months for the Price of ${priceOfMonths}` : copy?.badge ?? null;
            return (
              <article key={`${p.tier}-${billing}`} className={`mge-price-card ${popular ? 'mge-popular' : ''}`}>
                {badge && <div className="mge-popular-label mge-popular-label-wide">{badge}</div>}
                <div className="mge-plan-heading">
                  <div className={`mge-plan-symbol ${popular ? 'mge-sym-gold' : free ? 'mge-sym-green' : 'mge-sym-violet'}`}>
                    <Icon size={30} />
                  </div>
                  <div>
                    <h3>{free ? p.name : `${p.name} ${billing === 'yearly' ? 'Yearly' : 'Monthly'}`}</h3>
                    {!copy && <p>{p.tagline}</p>}
                  </div>
                </div>
                <div className="mge-price">
                  {rupees(cycle === 'yearly' ? p.price_yearly : p.price_monthly)}
                  {/* A free plan's price has no period: its validity line says how long it lasts. */}
                  {!(free && copy) && <span> / {cycle === 'yearly' ? 'year' : 'month'}</span>}
                </div>
                {popular && monthlyCost !== null && saving > 0 && (
                  <p className="mge-price-save">
                    Just {rupees(monthlyCost)} per month — save {rupees(saving)} compared to the Monthly Plan.
                  </p>
                )}
                {copy && (
                  <>
                    <p className="mge-plan-headline">{copy.headline}</p>
                    <p className="mge-plan-blurb">{copy.description}</p>
                    <p className="mge-included-title">What’s included</p>
                  </>
                )}
                <ul>
                  {copy
                    ? copy.included.map(({ title, detail }) => (
                        <li key={title}>
                          <CheckCircle2 size={17} />
                          <span>
                            <strong>{title}</strong>
                            <span className="mge-perk-detail"> – {detail}</span>
                          </span>
                        </li>
                      ))
                    : perksFor(p, cycle).map(perk => (
                        <li key={perk}>
                          <CheckCircle2 size={17} />
                          {perk}
                        </li>
                      ))}
                </ul>
                {copy && !free && (
                  <p className="mge-best-for">
                    <strong>Best for:</strong> {copy.best_for}
                  </p>
                )}
                <ButtonLink
                  to={free ? CONFIG.signupPath : `${CONFIG.signupPath}?plan=${p.tier}`}
                  secondary={!popular}
                  className="mge-price-btn"
                >
                  {copy?.cta || (free ? 'Start Free Trial' : `Choose ${billing === 'yearly' ? 'Yearly' : 'Monthly'}`)}
                </ButtonLink>
              </article>
            );
          })}
        </div>
        <TopUps />
        {plans.length > 0 && (
          <p className="mge-pricing-note">
            {savings ? `Yearly plans are paid once for the full year — ${savings.min === savings.max ? 'about' : 'up to'} ${savings.max}% less than monthly.` : 'Yearly plans are paid once for the full year.'}
          </p>
        )}
      </div>
    </section>
  );
}

/** Refer & Earn, told once, with the three things a visitor asks: what do I do, what do I get, when is it paid. */
const referralSteps: Array<{ icon: LucideIcon; title: ContentKey; desc: ContentKey }> = [
  { icon: Users, title: 'landing.referral.1.title', desc: 'landing.referral.1.desc' },
  { icon: Sparkles, title: 'landing.referral.2.title', desc: 'landing.referral.2.desc' },
  { icon: Gift, title: 'landing.referral.3.title', desc: 'landing.referral.3.desc' },
];

function Referral() {
  const t = useT();
  return (
    <section className="mge-container" id="refer-and-earn" aria-labelledby="mge-ref-title">
      <div className="mge-ref">
        <span className="mge-ref-orb mge-ref-orb-a" aria-hidden="true" />
        <span className="mge-ref-orb mge-ref-orb-b" aria-hidden="true" />
        <div className="mge-ref-top">
          <div className="mge-ref-copy">
            <span className="mge-ref-kicker">
              <Gift size={14} aria-hidden="true" /> {t('landing.referral.kicker')}
            </span>
            <h2 id="mge-ref-title">
              <Rich text={t('landing.referral.title')} />
            </h2>
            <p>{t('landing.referral.desc')}</p>
            <div className="mge-ref-big">
              <strong>{t('landing.referral.rate')}</strong>
              <span>
                <Rich text={t('landing.referral.rateDesc')} />
              </span>
            </div>
            <div className="mge-ref-actions">
              <ButtonLink to={CONFIG.signupPath} className="mge-ref-cta">
                {t('landing.referral.cta')} <ArrowRight size={18} />
              </ButtonLink>
              <span className="mge-ref-note">
                <CalendarDays size={15} aria-hidden="true" /> {t('landing.referral.window')}
              </span>
            </div>
          </div>

          {/* A picture of a member's Refer & Earn page, not the page: it says so up top, the code is a placeholder, and it
              has no buttons — a "Copy" or "Share on WhatsApp" here read as things to press. */}
          <div className="mge-ref-mock" aria-hidden="true">
            <p className="mge-ref-preview">
              <Eye size={14} /> Preview of your Refer &amp; Earn page
            </p>
            <p className="mge-ref-mock-label">Your referral code</p>
            <span className="mge-ref-code">MGE-XXXXX</span>
            <p className="mge-ref-mock-hint">Sign up to get your own code, ready to copy and share on WhatsApp.</p>
            <div className="mge-ref-mock-stats">
              <div>
                <Users size={16} />
                <strong>3</strong>
                <span>Friends referred</span>
              </div>
              <div>
                <CheckCircle2 size={16} />
                <strong>2</strong>
                <span>Paid users</span>
              </div>
              <div>
                <Wallet size={16} />
                <strong>₹450</strong>
                <span>Total earned</span>
              </div>
            </div>
            <p className="mge-ref-mock-foot">Sample figures</p>
          </div>
        </div>

        <ol className="mge-ref-steps">
          {referralSteps.map((st, i) => (
            <li key={st.title}>
              <span className="mge-ref-num">{i + 1}</span>
              <div>
                <h3>{t(st.title)}</h3>
                <p>{t(st.desc)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FinalCta() {
  const t = useT();
  const liveExams = useLiveExams();
  return (
    <section className="mge-container mge-cta-section">
      <div className="mge-final-cta">
        <div>
          <Rocket size={64} />
          <div>
            <h2>{t('landing.cta.title')}</h2>
            <p>{t('landing.cta.join', { students: t('site.stats.aspirants'), exams: joinExamNames(liveExams) })}</p>
          </div>
        </div>
        <ButtonLink to={CONFIG.signupPath}>
          {t('landing.nav.cta')} <ArrowRight size={18} />
        </ButtonLink>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const t = useT();
  // "Pricing" in the header of the login and sign-up pages comes back here, to that section.
  const location = useLocation();
  useEffect(() => {
    const target = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (!target) return;
    // After the page (and the plan cards) have laid out, so the section is where it will stay.
    const t = window.setTimeout(() => scrollToSection(target), 120);
    return () => window.clearTimeout(t);
  }, [location.state]);

  // The app's own title is for the portal; this page is the public face of the product.
  useEffect(() => {
    const previous = document.title;
    document.title = t('landing.page.title');
    return () => {
      document.title = previous;
    };
  }, [t]);

  return (
    <div className="mge">
      <LandingHeader />
      <main>
        <Hero />
        <FreshAttempts />
        <Stats />
        <Features />
        <ExamBanner />
        <HowItWorks />
        <Referral />
        <Pricing />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
