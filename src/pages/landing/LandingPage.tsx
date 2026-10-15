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
  Rocket,
  Sparkles,
  Star,
  Target,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { publicApi } from '@/lib/api';
import { offeredPlans, perksFor, plansFromApi, yearlySavings } from '@/lib/plans';
import { PLAN_COPY } from '@/lib/plan-copy';
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
  students: '5,000+',
  questionsAddedWeekly: '1000+',
  satisfaction: '95%',
  loginPath: ROUTES.login,
  signupPath: ROUTES.signup,
};

const heroChecks = ['Full mock tests', 'Unit-wise practice', 'Previous year papers', 'AI performance reports'];

/** The "Powered by AI" cards. `tone` picks the tint of the icon circle. */
const features: Array<{ icon: LucideIcon; title: string; desc: string; tone: string }> = [
  {
    icon: ClipboardList,
    title: 'AI-Powered Full Mock Tests',
    desc: 'Experience exam-style mock tests with a fresh set of AI-generated questions every time you attempt a test. Practise more, improve accuracy and build exam confidence.',
    tone: 'blue',
  },
  {
    icon: Target,
    title: 'Smart Subject & Unit-wise Practice',
    desc: 'Practise with AI-generated questions across subjects and units. Choose Simple, Medium or Complex levels and learn with clear, easy-to-understand AI explanations.',
    tone: 'pink',
  },
  {
    icon: BookOpen,
    title: 'Previous-Year Question Papers',
    desc: 'Practise real previous year questions and get AI-powered explanations to understand exam patterns, important topics and frequently asked questions.',
    tone: 'purple',
  },
  {
    icon: BarChart3,
    title: 'Comprehensive AI Performance Analysis',
    desc: 'Get detailed AI-driven insights into your score, accuracy, strengths, weak areas and topic-wise performance with clear recommendations on what to focus on next.',
    tone: 'green',
  },
  {
    icon: CalendarDays,
    title: 'AI-Personalized Study Plans',
    desc: 'Turn your performance insights into a step-by-step study plan. Let AI identify improvement areas, recommend the right topics and create a practical plan to help you succeed faster.',
    tone: 'rose',
  },
];

const steps: Array<{ name: string; desc: string; icon: LandingIcon }> = [
  { name: 'Choose a Test', desc: 'Take a full mock test or practice by subject, part and unit.', icon: ChooseTestIcon },
  { name: 'Practice & Learn', desc: 'Attempt questions at Simple, Medium and Complex levels.', icon: PracticeIcon },
  { name: 'Get Your AI Report', desc: 'See your score, accuracy, strengths, weak areas and comparisons.', icon: ReportIcon },
  { name: 'Build Your Study Plan', desc: 'Get a personalized plan based on your performance and focus on weak topics.', icon: PlanIcon },
];

function Hero() {
  return (
    <section id="home" className="mge-hero">
      <div className="mge-container mge-hero-grid">
        <div className="mge-hero-copy">
          <div className="mge-eyebrow mge-eyebrow-ai">
            <Sparkles size={14} aria-hidden="true" />
            End-to-end AI-powered exam preparation
          </div>
          <h1>
            Your Government Exam <span>Preparation</span> Starts Here
          </h1>
          <p className="mge-lead">
            From <span className="mge-nowrap">AI-generated</span> questions to easy-to-understand explanations,
            full-length mock tests, personalized performance insights and <span className="mge-nowrap">AI-driven</span>{' '}
            study plans — everything you need to prepare smarter, all in one platform.
          </p>
          <div className="mge-hero-actions">
            <ButtonLink to={CONFIG.signupPath}>
              Start Free Trial <ArrowRight size={19} />
            </ButtonLink>
            {/* Phones only: the header's Login is behind the menu button there. */}
            <ButtonLink to={CONFIG.loginPath} secondary className="mge-hero-login">
              Login
            </ButtonLink>
            <SectionLink to="pricing" className="mge-btn mge-btn-secondary">
              View Plans
            </SectionLink>
          </div>
          <div className="mge-checks">
            {heroChecks.map(c => (
              <span key={c}>
                <CheckCircle2 /> {c}
              </span>
            ))}
          </div>
        </div>
        <div className="mge-hero-art">
          <img src={`${ART}hero.png`} alt="A student preparing for her government exam" />
          {/* Live text on the artwork, not painted into it: crisp at any size, and editable. */}
          <p className="mge-art-note">
            Your AI
            <br />
            Study
            <br />
            Partner
          </p>
          <div className="mge-art-badge">
            <Trophy size={18} aria-hidden="true" />
            Learn. Practice. Succeed with AI.
          </div>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  const items: Array<{ icon: LucideIcon; value: string; label: string; tone: string }> = [
    { icon: Users, value: CONFIG.students, label: 'Students Learning with Us', tone: 'blue' },
    { icon: FileText, value: CONFIG.questionsAddedWeekly, label: 'Questions Added Every Week', tone: 'sky' },
    { icon: Star, value: CONFIG.satisfaction, label: 'Student Satisfaction', tone: 'gold' },
    { icon: BarChart3, value: 'Government Exams', label: 'Focused Preparation', tone: 'green' },
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
              <span>{s.label}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="mge-container mge-ai-section" aria-labelledby="mge-ai-title">
      <div className="mge-ai-heading">
        <h2 id="mge-ai-title">
          Powered by <span>AI.</span> Designed for Your Success.
        </h2>
        <p>From your first practice question to your personalized study plan, AI supports every step of your preparation.</p>
      </div>
      <div className="mge-ai-grid">
        {features.map(f => (
          <article className="mge-ai-card" key={f.title}>
            <div className="mge-ai-card-head">
              <span className={`mge-ai-icon mge-ai-${f.tone}`}>
                <f.icon size={26} aria-hidden="true" />
              </span>
              <h3>{f.title}</h3>
            </div>
            <p>{f.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ExamBanner() {
  return (
    <section className="mge-container">
      <div className="mge-exam-banner">
        <div className="mge-exam-copy">
          <span className="mge-kicker">Currently Available</span>
          <h2>TNPSC Group 4</h2>
          <p>Complete preparation with full mock tests, unit-wise practice tests and previous year question papers.</p>
        </div>
        <div className="mge-exam-art">
          <img src={`${ART}building.png`} alt="" aria-hidden />
        </div>
        <div className="mge-soon">
          <AnnounceIcon size={52} />
          <div>
            <strong>More Government Exams Coming Soon</strong>
            <p>We are working to bring more exams to the platform.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The four product previews under the steps. Drawings, not data. */
function DemoCards() {
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
        <figcaption>Real exam interface with new questions every time</figcaption>
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
        <figcaption>Practice by subject, part and unit with different difficulty levels</figcaption>
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
        <figcaption>Detailed AI-powered analysis of your performance</figcaption>
      </figure>

      <figure>
        <div className="mge-demo-card">
          <h4>Personalized Study Plan</h4>
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
        <figcaption>Get a smart plan to improve your score step by step</figcaption>
      </figure>
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="mge-container mge-section" id="how-it-works">
      <div className="mge-section-heading mge-left">
        <h2>How It Works</h2>
        <p>A simple way to prepare, practice and improve.</p>
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
            <h3>{s.name}</h3>
            <p>{s.desc}</p>
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

function Pricing() {
  const { plans, loading, failed, retry } = useLandingPlans();
  const [billing, setBilling] = useState<Billing>('monthly');
  const savings = yearlySavings(plans);
  // No toggle unless a paid plan actually has a yearly price to show.
  const hasYearly = plans.some(p => p.price_monthly > 0 && p.price_yearly > 0);
  return (
    <section className="mge-pricing-section" id="pricing">
      <div className="mge-container">
        <div className="mge-section-heading">
          <h2>Simple Plans for Serious Preparation</h2>
          <p>Choose a plan that fits your goals.</p>
        </div>
        {hasYearly && (
          <div className="mge-billing">
            <div className="mge-billing-toggle" role="group" aria-label="Billing period">
              <button type="button" aria-pressed={billing === 'monthly'} onClick={() => setBilling('monthly')}>
                Monthly
              </button>
              <button type="button" aria-pressed={billing === 'yearly'} onClick={() => setBilling('yearly')}>
                Yearly
                {savings && (
                  <span className="mge-billing-save">
                    SAVE {savings.min === savings.max ? '' : 'UP TO '}
                    {savings.max}%
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
        {loading && (
          <div className="mge-pricing-grid" aria-busy="true" aria-label="Loading plans">
            {[0, 1, 2].map(i => (
              <div className="mge-price-card mge-price-skeleton" key={i} />
            ))}
          </div>
        )}
        {failed && !loading && (
          <div className="mge-pricing-error" role="status">
            <p>We couldn't load the plans just now.</p>
            <button type="button" className="mge-btn mge-btn-secondary" onClick={retry}>
              Try again
            </button>
          </div>
        )}
        <div className={plans.length >= 4 ? 'mge-pricing-grid mge-pricing-grid-4' : 'mge-pricing-grid'}>
          {plans.map(p => {
            const free = p.price_monthly === 0;
            const popular = !!p.highlight;
            const Icon = popular ? Crown : free ? Gift : Gem;
            // A paid plan with no yearly price keeps showing its monthly one rather than ₹0.
            const cycle: Billing = billing === 'yearly' && (free || p.price_yearly > 0) ? 'yearly' : 'monthly';
            // The pitch for this plan and cycle, when there is one; otherwise the plan's own tagline and perks.
            const copy = PLAN_COPY[p.tier]?.[cycle];
            const badge = copy?.badge ?? (popular ? 'Most Popular' : null);
            return (
              <article key={p.tier} className={`mge-price-card ${popular ? 'mge-popular' : ''}`}>
                {badge && <div className={copy?.badge ? 'mge-popular-label mge-popular-label-wide' : 'mge-popular-label'}>{badge}</div>}
                <div className="mge-plan-heading">
                  <div className={`mge-plan-symbol ${popular ? 'mge-sym-gold' : free ? 'mge-sym-green' : 'mge-sym-violet'}`}>
                    <Icon size={30} />
                  </div>
                  <div>
                    <h3>{p.name}</h3>
                    <p>{copy ? copy.validity : p.tagline}</p>
                  </div>
                </div>
                <div className="mge-price">
                  {rupees(cycle === 'yearly' ? p.price_yearly : p.price_monthly)}
                  {/* A free plan's price has no period: its validity line says how long it lasts. */}
                  {!(free && copy) && <span> / {cycle === 'yearly' ? 'year' : 'month'}</span>}
                </div>
                {copy && (
                  <>
                    <p className="mge-plan-headline">{copy.headline}</p>
                    <p className="mge-plan-blurb">{copy.blurb}</p>
                    <p className="mge-included-title">What’s included</p>
                  </>
                )}
                <ul>
                  {copy
                    ? copy.included.map(([title, detail]) => (
                        <li key={title}>
                          <CheckCircle2 size={17} />
                          <span>
                            <strong>{title}</strong> – {detail}
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
                {copy && (
                  <p className="mge-best-for">
                    <strong>Best for:</strong> {copy.bestFor}
                  </p>
                )}
                <ButtonLink
                  to={free ? CONFIG.signupPath : `${CONFIG.signupPath}?plan=${p.tier}`}
                  secondary={!popular}
                  className="mge-price-btn"
                >
                  {copy?.cta ?? (free ? 'Start Free Trial' : `Choose ${p.name}`)}
                </ButtonLink>
              </article>
            );
          })}
        </div>
        {plans.length > 0 && (
          <p className="mge-pricing-note">{pricingNote(billing, savings)}</p>
        )}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mge-container mge-cta-section">
      <div className="mge-final-cta">
        <div>
          <Rocket size={64} />
          <div>
            <h2>Take the First Step Towards Your Goal</h2>
            <p>Join {CONFIG.students} aspirants preparing for TNPSC Group 4 with MyGovExams.</p>
          </div>
        </div>
        <ButtonLink to={CONFIG.signupPath}>
          Start Free Trial <ArrowRight size={18} />
        </ButtonLink>
      </div>
    </section>
  );
}

export default function LandingPage() {
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
    document.title = 'MyGovExams | Prepare Smarter';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="mge">
      <LandingHeader />
      <main>
        <Hero />
        <Stats />
        <Features />
        <ExamBanner />
        <HowItWorks />
        <Pricing />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
