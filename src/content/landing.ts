import { defineContent } from './define';
import { EXAMS_STATS } from '@/config/exams-page';

/**
 * The public landing page and its header/footer, the figures shown on it and on the Exams page, and the support contact
 * used across the app. Keys: `landing.<section>.<name>`, `site.<…>` for what is shared.
 * (Which exams are "Live" is its own setting — Live exams — not a text field.)
 */
export const landing = defineContent('Landing page', {
  // ── Shared across the app ──────────────────────────────────────────────────────
  'site.support.email': { label: 'Support — email address', default: 'admin@fgilservices.com', hint: 'Shown in the footer, legal pages, the portal help menu and referral mail.' },
  'site.support.phone': { label: 'Support — phone number', default: '+91 96596 06012', hint: 'Shown as typed; the call link keeps only digits and +.' },
  'site.stats.questions': { label: 'Figure — questions available', default: EXAMS_STATS.questions, hint: 'A display claim, not measured by the app. Shown on the landing page and the Exams page.' },
  'site.stats.aspirants': { label: 'Figure — aspirants practising', default: EXAMS_STATS.aspirants, hint: 'Also used in “Join … aspirants” at the foot of the landing page.' },
  'site.stats.newQuestions': { label: 'Figure — new questions added every week', default: EXAMS_STATS.newQuestions },

  // ── Page / navigation ──────────────────────────────────────────────────────────
  'landing.page.title': { label: 'Browser tab title', default: 'MyGovExams | Prepare Smarter' },
  'landing.nav.home': { label: 'Header & footer — Home link', default: 'Home' },
  'landing.nav.pricing': { label: 'Header & footer — Pricing link', default: 'Pricing' },
  'landing.nav.login': { label: 'Header & footer — Login link', default: 'Login' },
  'landing.nav.cta': { label: 'Header, hero & footer — Start Free Trial button', default: 'Start Free Trial' },

  // ── Hero ───────────────────────────────────────────────────────────────────────
  'landing.hero.eyebrow': { label: 'Hero — small line above the heading', default: 'End-to-end AI-powered exam preparation' },
  'landing.hero.title': { label: 'Hero — main heading', default: 'Your Government Exam *Preparation* Starts Here', hint: 'Words between *stars* are shown in the accent colour.' },
  'landing.hero.live': { label: 'Hero — “Live” badge', default: 'Live' },
  'landing.hero.lead': {
    label: 'Hero — paragraph under the heading',
    default:
      'Prepare smarter with syllabus-aligned questions and practice tests organised by Unit, Category, and Subcategory, across Simple, Medium, and Complex levels. Take full-length mock exams, learn with clear explanations, and improve with AI-powered performance insights and personalized study plans — all in one place.',
    multiline: true,
  },
  'landing.hero.plans': { label: 'Hero — View Plans button', default: 'View Plans' },
  'landing.hero.check1': { label: 'Hero — tick list, item 1', default: 'Full mock tests' },
  'landing.hero.check2': { label: 'Hero — tick list, item 2', default: 'Unit-wise practice' },
  'landing.hero.check3': { label: 'Hero — tick list, item 3', default: 'Previous year papers' },
  'landing.hero.check4': { label: 'Hero — tick list, item 4', default: 'AI performance reports' },
  'landing.hero.note': { label: 'Hero — text on the picture', default: 'Your AI\nStudy\nPartner', multiline: true, hint: 'One word or phrase per line.' },
  'landing.hero.badge': { label: 'Hero — badge on the picture', default: 'Learn. Practice. Succeed with AI.' },

  // ── "New questions every attempt" ─────────────────────────────────────────────
  'landing.fresh.tag': { label: 'Fresh questions — “New” tag', default: 'New' },
  'landing.fresh.title': { label: 'Fresh questions — heading', default: 'New Questions. Every Attempt.' },
  'landing.fresh.desc': {
    label: 'Fresh questions — paragraph',
    default: 'Get a fresh set of questions every time you take a mock test. Practice more, challenge yourself and build exam confidence.',
    multiline: true,
  },
  'landing.fresh.p1': { label: 'Fresh questions — point 1', default: 'Fresh Question Sets for Every Attempt' },
  'landing.fresh.p2': { label: 'Fresh questions — point 2', default: 'Multiple Difficulty Levels (Simple to Complex)' },
  'landing.fresh.p3': { label: 'Fresh questions — point 3', default: 'AI-Powered Explanations' },
  'landing.fresh.p4': { label: 'Fresh questions — point 4', default: 'Track Progress & Improve Faster' },

  // ── Figures band ───────────────────────────────────────────────────────────────
  'landing.stats.questions.label': { label: 'Figures — questions label', default: 'Questions' },
  'landing.stats.questions.sub': { label: 'Figures — questions sub-line', default: 'with various difficulty levels' },
  'landing.stats.aspirants.label': { label: 'Figures — aspirants label', default: 'Aspirants' },
  'landing.stats.aspirants.sub': { label: 'Figures — aspirants sub-line', default: 'currently practising here' },
  'landing.stats.new.label': { label: 'Figures — new questions label', default: 'New Questions' },
  'landing.stats.new.sub': { label: 'Figures — new questions sub-line', default: 'added every week' },
  'landing.stats.focus.value': { label: 'Figures — fourth tile, big text', default: 'Government Exams' },
  'landing.stats.focus.label': { label: 'Figures — fourth tile, label', default: 'Focused Preparation' },

  // ── Feature cards ──────────────────────────────────────────────────────────────
  'landing.features.title': { label: 'Features — heading', default: 'Expert-Curated Questions. *AI-Powered Insights.*', hint: 'Words between *stars* are shown in the accent colour.' },
  'landing.features.lead': {
    label: 'Features — paragraph under the heading',
    default: 'Practice with expert-validated questions, track your performance through AI-powered analytics, and improve with personalized study recommendations.',
    multiline: true,
  },
  'landing.features.1.title': { label: 'Feature card 1 — title', default: 'Expert-Curated Mock Tests' },
  'landing.features.1.desc': {
    label: 'Feature card 1 — description',
    default:
      'Experience real exam-style mock tests with carefully curated and validated questions. Get a fresh set of questions with every attempt to strengthen your knowledge, improve accuracy, and build exam confidence.',
    multiline: true,
  },
  'landing.features.2.title': { label: 'Feature card 2 — title', default: 'Smart Subject & Unit-wise Practice' },
  'landing.features.2.desc': {
    label: 'Feature card 2 — description',
    default:
      'Practice with expert-validated questions across subjects and units. Choose Simple, Medium, or Complex difficulty levels and strengthen your understanding with detailed explanations.',
    multiline: true,
  },
  'landing.features.3.title': { label: 'Feature card 3 — title', default: 'Previous Year Question Papers' },
  'landing.features.3.desc': {
    label: 'Feature card 3 — description',
    default: 'Practice authentic previous-year questions with detailed explanations. Understand exam patterns, important topics, and frequently tested concepts.',
    multiline: true,
  },
  'landing.features.4.title': { label: 'Feature card 4 — title', default: 'AI-Powered Performance Insights' },
  'landing.features.4.desc': {
    label: 'Feature card 4 — description',
    default:
      'Understand your strengths, weaknesses, accuracy, and topic-wise performance through AI-driven analysis. Identify improvement areas and prepare more effectively.',
    multiline: true,
  },
  'landing.features.5.title': { label: 'Feature card 5 — title', default: 'AI-Personalized Study Plans' },
  'landing.features.5.desc': {
    label: 'Feature card 5 — description',
    default: 'Get personalized study recommendations based on your performance, knowledge gaps, and learning progress.',
    multiline: true,
  },

  // ── "Currently available" banner ──────────────────────────────────────────────
  'landing.banner.kicker': { label: 'Exam banner — small heading', default: 'Currently Available' },
  'landing.banner.desc': {
    label: 'Exam banner — paragraph',
    default: 'Complete preparation with full mock tests, unit-wise practice tests and previous year question papers.',
    multiline: true,
    hint: 'The exam names above it are set under Live exams.',
  },
  'landing.banner.soon.title': { label: 'Exam banner — “coming soon” title', default: 'More Government Exams Coming Soon' },
  'landing.banner.soon.desc': { label: 'Exam banner — “coming soon” line', default: 'We are working to bring more exams to the platform.' },

  // ── How it works ──────────────────────────────────────────────────────────────
  'landing.how.title': { label: 'How it works — heading', default: 'How It Works' },
  'landing.how.lead': { label: 'How it works — line under the heading', default: 'A simple way to prepare, practice and improve.' },
  'landing.how.1.name': { label: 'Step 1 — title', default: 'Choose a Test' },
  'landing.how.1.desc': { label: 'Step 1 — description', default: 'Take a full mock test or practice by subject, part and unit.', multiline: true },
  'landing.how.2.name': { label: 'Step 2 — title', default: 'Practice & Learn' },
  'landing.how.2.desc': { label: 'Step 2 — description', default: 'Attempt questions at Simple, Medium, and Complex difficulty levels.', multiline: true },
  'landing.how.3.name': { label: 'Step 3 — title', default: 'Get Your AI Report' },
  'landing.how.3.desc': { label: 'Step 3 — description', default: 'See your score, accuracy, strengths, weak areas and comparisons.', multiline: true },
  'landing.how.4.name': { label: 'Step 4 — title', default: 'Build Your Study Plan' },
  'landing.how.4.desc': { label: 'Step 4 — description', default: 'Get a personalized plan based on your performance and focus on weak topics.', multiline: true },
  'landing.how.demo1': { label: 'Preview caption 1 (mock test)', default: 'Experience a realistic exam interface with a fresh set of questions for every attempt.' },
  'landing.how.demo2': { label: 'Preview caption 2 (unit practice)', default: 'Practice by subject, part and unit with different difficulty levels' },
  'landing.how.demo3': { label: 'Preview caption 3 (AI report)', default: 'Detailed AI-powered analysis of your performance' },
  'landing.how.demo4': { label: 'Preview caption 4 (study plan)', default: 'Get a personalized study plan to improve your performance step by step.' },

  // ── Pricing ───────────────────────────────────────────────────────────────────
  'landing.pricing.title': { label: 'Pricing — heading', default: 'Simple Plans for Serious Preparation' },
  'landing.pricing.lead': { label: 'Pricing — line under the heading', default: 'Choose a plan that fits your goals.' },
  'landing.pricing.error': { label: 'Pricing — message when plans cannot load', default: "We couldn't load the plans just now." },
  'landing.topups.title': { label: 'Top-ups — heading', default: 'Need more tests?' },
  'landing.topups.desc': {
    label: 'Top-ups — paragraph',
    default: 'Add a top-up to your Monthly or Yearly plan. Unused top-up tests are saved and carried forward when you renew your subscription.',
    multiline: true,
  },

  // ── Refer & earn ──────────────────────────────────────────────────────────────
  'landing.referral.kicker': { label: 'Refer & Earn — small tag', default: 'Refer & Earn' },
  'landing.referral.title': { label: 'Refer & Earn — heading', default: 'Share MyGovExams. *Earn real cash.*', hint: 'Words between *stars* are shown in the accent colour.' },
  'landing.referral.desc': {
    label: 'Refer & Earn — paragraph',
    default: 'Invite friends who are preparing for government exams. When they subscribe, you earn cash — paid out to your UPI or bank account.',
    multiline: true,
  },
  'landing.referral.rate': { label: 'Refer & Earn — big figure', default: '5%', hint: 'Keep this in step with the referral rate the server pays.' },
  'landing.referral.rateDesc': { label: 'Refer & Earn — text beside the big figure', default: 'cash on every eligible\npurchase your friend makes', multiline: true },
  'landing.referral.cta': { label: 'Refer & Earn — button', default: 'Get your referral code' },
  'landing.referral.window': { label: 'Refer & Earn — withdrawal window note', default: 'Withdraw from the 1st to the 7th of every month', hint: 'Keep this in step with the server’s withdrawal window.' },
  'landing.referral.1.title': { label: 'Refer & Earn step 1 — title', default: 'Share your code' },
  'landing.referral.1.desc': { label: 'Refer & Earn step 1 — description', default: 'Every account gets a personal referral code and link, ready to share on WhatsApp.', multiline: true },
  'landing.referral.2.title': { label: 'Refer & Earn step 2 — title', default: 'Your friend joins and subscribes' },
  'landing.referral.2.desc': { label: 'Refer & Earn step 2 — description', default: 'They sign up with your code and buy a plan.', multiline: true },
  'landing.referral.3.title': { label: 'Refer & Earn step 3 — title', default: 'You earn cash' },
  'landing.referral.3.desc': { label: 'Refer & Earn step 3 — description', default: 'You get 5% of their eligible purchases as real cash.', multiline: true },

  // ── Closing call to action ────────────────────────────────────────────────────
  'landing.cta.title': { label: 'Closing banner — heading', default: 'Take the First Step Towards Your Goal' },
  'landing.cta.join': {
    label: 'Closing banner — sentence',
    default: 'Join {students} aspirants preparing for {exams} with MyGovExams.',
    vars: ['students', 'exams'],
    hint: '{exams} is the Live exams list.',
  },

  // ── Footer ────────────────────────────────────────────────────────────────────
  'landing.footer.tagline': { label: 'Footer — tagline', default: 'Practice • Analyze • Improve' },
  'landing.footer.blurb': {
    label: 'Footer — description',
    default: 'AI-powered mock tests, unit-wise practice and performance insights for government exam aspirants.',
    multiline: true,
  },
  'landing.footer.quick': { label: 'Footer — “Quick Links” heading', default: 'Quick Links' },
  'landing.footer.legal': { label: 'Footer — “Legal” heading', default: 'Legal' },
  'landing.footer.contact': { label: 'Footer — “Contact Us” heading', default: 'Contact Us' },
  'landing.footer.copy': { label: 'Footer — copyright line', default: '© {year} MyGovExams. All rights reserved.', vars: ['year'] },
  'landing.footer.powered': { label: 'Footer — “Powered by” line', default: 'Powered by FutureGen Innovation Lab Pvt Ltd' },
});
