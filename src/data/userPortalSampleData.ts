// Sample data for the User Portal — replace with real API calls once backend is ready.

export type SubscriptionTier = 'free' | 'standard' | 'ultimate' | 'premium';
export type AssessmentMode = 'practice' | 'mock';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';

// All questions on this platform are MCQ-family — but the question stem/structure varies.
// These subtypes match the patterns used by ICAI/ICMAI/ICSI examinations.
export type McqSubtype =
  | 'standard'           // Plain single-correct MCQ
  | 'multi_correct'      // Multiple correct options
  | 'assertion_reasoning'// Assertion (A) + Reason (R) with standard 4-option key
  | 'case_study'         // Reading passage + sub-questions
  | 'hots'               // Higher Order Thinking Skills — analytical / application-based
  | 'matching';          // Match Column-A with Column-B (presented as MCQ option set)

export interface McqSubtypeMix {
  subtype: McqSubtype;
  count: number;
}

export interface SampleCourse {
  course_id: string;
  name: string;
  description: string;
  subject: string;
  total_tests: number;
  thumbnail_color: string;
  enrolled_at: string;
  exam_body?: 'ICAI' | 'ICMAI' | 'ICSI' | 'Other';
}

export interface SampleTest {
  test_id: string;
  course_id: string;
  name: string;
  subject: string;
  mode: AssessmentMode;
  question_count: number;
  time_limit_min: number;
  difficulty: Difficulty;
  negative_marking: boolean;
  negative_marking_fraction?: number;
  required_tier: SubscriptionTier;
  promo_code?: string;
  /** Discount % when promo_code is applied. 100 = free, 50 = half price, etc. Defaults to 100 if omitted. */
  promo_discount_pct?: number;
  /** Test fee in INR (admin-configured at assessment creation). 0 = free. */
  price?: number;
  published_at: string;
  is_new?: boolean;
  // Breakdown of MCQ subtypes within this test. Sum should equal question_count.
  subtype_mix?: McqSubtypeMix[];
  /** Max attempts allowed. Practice defaults to 3, mock to 1 when omitted. */
  max_attempts?: number;
}

/** Default per-mode attempt cap when `max_attempts` is not set on the test. */
export const DEFAULT_MAX_ATTEMPTS: Record<AssessmentMode, number> = {
  practice: 3,
  mock: 1,
};

/** Resolve effective max attempts for a test. */
export function getMaxAttempts(test: SampleTest): number {
  return test.max_attempts ?? DEFAULT_MAX_ATTEMPTS[test.mode];
}

export const SUBTYPE_META: Record<McqSubtype, { label: string; short: string; description: string }> = {
  standard: {
    label: 'Standard MCQ',
    short: 'MCQ',
    description: 'Single-correct multiple choice questions.',
  },
  multi_correct: {
    label: 'Multiple Correct',
    short: 'MC',
    description: 'One or more options may be correct. Partial marking may apply.',
  },
  assertion_reasoning: {
    label: 'Assertion & Reasoning',
    short: 'A&R',
    description:
      'Statement (A) and Reason (R). Standard 4-option key: both true & R explains A; both true but R does not explain A; A true R false; A false R true.',
  },
  case_study: {
    label: 'Case Study',
    short: 'Case',
    description: 'A scenario / case-let followed by 4–6 inter-linked MCQs. Heavily used in ICAI Inter & Final papers.',
  },
  hots: {
    label: 'Higher Order Thinking',
    short: 'HOTS',
    description: 'Analytical and application-based MCQs requiring multi-step reasoning.',
  },
  matching: {
    label: 'Matching',
    short: 'Match',
    description: 'Match Column-A items with Column-B items, presented as MCQ option pairs.',
  },
};

export interface SampleNotification {
  notification_id: string;
  user_id: string;
  type: 'new_test' | 'subscription_expiry' | 'report_ready' | 'system';
  message: string;
  test_id?: string;
  course_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface SampleAttempt {
  attempt_id: string;
  test_id: string;
  test_name: string;
  course_id: string;
  course_name: string;
  mode: AssessmentMode;
  score: number;
  total_marks: number;
  percentage: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  time_taken_sec: number;
  date: string;
  passed: boolean;
  percentile?: number;
  malpractice_events?: number;
  auto_submitted?: boolean;
  ai_report?: SampleAIReport;
}

export interface SampleAIReport {
  report_id: string;
  attempt_id: string;
  summary: string;
  strengths: string[];
  weaknesses: { topic: string; accuracy: number; recommendation: string }[];
  time_analysis: { avg_seconds_per_question: number; slow_questions: number };
  question_reviews: {
    q_no: number;
    question: string;
    your_answer: string;
    correct_answer: string;
    is_correct: boolean;
    explanation: string;
    time_spent_sec: number;
  }[];
  recommendations: string[];
  generated_at: string;
}

export interface PlanFeatures {
  practice_tests_per_month: number | 'unlimited';
  mock_tests_per_month: number | 'unlimited' | 'none';
  ai_report_level: 'basic' | 'standard' | 'detailed' | 'full';
  history_retention_days: number | 'unlimited';
  support: string;
  download_pdf: boolean;
}

export interface SubscriptionPlanInfo {
  tier: SubscriptionTier;
  name: string;
  price_monthly: number;
  price_yearly: number;
  highlight?: boolean;
  features: PlanFeatures;
  perks: string[];
}

export interface UserUsage {
  practice_tests_attempted_month: number;
  mock_tests_attempted_month: number;
  period_start: string;
}

export interface SampleUser {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  subscription_tier: SubscriptionTier;
  subscription_expiry: string;
  otp_verified: boolean;
  created_at: string;
  usage: UserUsage;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanInfo[] = [
  {
    tier: 'free',
    name: 'Free',
    price_monthly: 0,
    price_yearly: 0,
    features: {
      practice_tests_per_month: 2,
      mock_tests_per_month: 'none',
      ai_report_level: 'basic',
      history_retention_days: 30,
      support: 'Community',
      download_pdf: false,
    },
    perks: ['2 practice tests / month', 'Basic AI report', '30-day history'],
  },
  {
    tier: 'standard',
    name: 'Standard',
    price_monthly: 299,
    price_yearly: 2999,
    features: {
      practice_tests_per_month: 'unlimited',
      mock_tests_per_month: 3,
      ai_report_level: 'standard',
      history_retention_days: 90,
      support: 'Email',
      download_pdf: true,
    },
    perks: ['Unlimited practice', '3 mock tests / month', 'Standard AI report', 'PDF download'],
  },
  {
    tier: 'ultimate',
    name: 'Ultimate',
    price_monthly: 599,
    price_yearly: 5999,
    highlight: true,
    features: {
      practice_tests_per_month: 'unlimited',
      mock_tests_per_month: 'unlimited',
      ai_report_level: 'detailed',
      history_retention_days: 365,
      support: 'Priority Email',
      download_pdf: true,
    },
    perks: ['Unlimited practice & mock', 'Detailed AI report', '1-year history', 'Priority email'],
  },
  {
    tier: 'premium',
    name: 'Premium',
    price_monthly: 999,
    price_yearly: 9999,
    features: {
      practice_tests_per_month: 'unlimited',
      mock_tests_per_month: 'unlimited',
      ai_report_level: 'full',
      history_retention_days: 'unlimited',
      support: 'Dedicated',
      download_pdf: true,
    },
    perks: ['Everything in Ultimate', 'Priority mock access', 'Full AI report', 'Dedicated support'],
  },
];

export const TIER_ORDER: SubscriptionTier[] = ['free', 'standard', 'ultimate', 'premium'];

export const SAMPLE_USER: SampleUser = {
  user_id: 'usr_001',
  name: 'Abhinav Sharma',
  email: 'abhinav@example.com',
  phone: '9876543210',
  subscription_tier: 'standard',
  subscription_expiry: '2026-08-14T00:00:00Z',
  otp_verified: true,
  created_at: '2026-01-15T10:00:00Z',
  usage: {
    practice_tests_attempted_month: 4,
    mock_tests_attempted_month: 1,
    period_start: '2026-05-01T00:00:00Z',
  },
};

export const SAMPLE_COURSES: SampleCourse[] = [
  {
    course_id: 'crs_ca_foundation',
    name: 'CA Foundation',
    description: 'Principles of Accounting, Business Laws, Quantitative Aptitude & Business Economics — ICAI entry level.',
    subject: 'Chartered Accountancy',
    total_tests: 22,
    thumbnail_color: 'from-blue-700 to-indigo-800',
    enrolled_at: '2026-01-20T00:00:00Z',
    exam_body: 'ICAI',
  },
  {
    course_id: 'crs_ca_inter',
    name: 'CA Intermediate',
    description: 'Advanced Accounting, Corporate Laws, Cost & Management Accounting, Taxation (DT + GST), Auditing & FM.',
    subject: 'Chartered Accountancy',
    total_tests: 26,
    thumbnail_color: 'from-indigo-700 to-violet-800',
    enrolled_at: '2026-02-25T00:00:00Z',
    exam_body: 'ICAI',
  },
  {
    course_id: 'crs_ca_final',
    name: 'CA Final',
    description: 'Financial Reporting (Ind AS), SFM, Advanced Auditing, Corporate & Economic Laws, Direct & Indirect Tax Laws.',
    subject: 'Chartered Accountancy',
    total_tests: 30,
    thumbnail_color: 'from-purple-700 to-fuchsia-800',
    enrolled_at: '2026-03-10T00:00:00Z',
    exam_body: 'ICAI',
  },
  {
    course_id: 'crs_gst',
    name: 'GST Mastery',
    description: 'Registration, ITC, Returns, e-Invoicing, Reverse Charge, Refunds — practical GST for accountants.',
    subject: 'Indirect Tax',
    total_tests: 14,
    thumbnail_color: 'from-amber-600 to-orange-700',
    enrolled_at: '2026-04-02T00:00:00Z',
  },
  {
    course_id: 'crs_income_tax',
    name: 'Income Tax Practice',
    description: 'Slabs & deductions, Capital Gains, TDS, Salary, House Property — Direct Tax computation drills.',
    subject: 'Direct Tax',
    total_tests: 16,
    thumbnail_color: 'from-rose-600 to-red-700',
    enrolled_at: '2026-04-15T00:00:00Z',
  },
  {
    course_id: 'crs_audit',
    name: 'Audit & Assurance',
    description: 'Standards on Auditing (SAs), Internal Audit, Bank Audit, Forensic Audit, Professional Ethics.',
    subject: 'Auditing',
    total_tests: 12,
    thumbnail_color: 'from-emerald-700 to-teal-800',
    enrolled_at: '2026-04-18T00:00:00Z',
  },
  {
    course_id: 'crs_cma_foundation',
    name: 'CMA Foundation',
    description: 'Cost & Management Accountancy entry — Fundamentals of Economics, Accounting, Laws & Business Math (ICMAI).',
    subject: 'Cost & Management Accountancy',
    total_tests: 18,
    thumbnail_color: 'from-slate-700 to-gray-900',
    enrolled_at: '2026-04-22T00:00:00Z',
    exam_body: 'ICMAI',
  },
];

export const SAMPLE_TESTS: SampleTest[] = [
  // ─── CA Foundation ───
  {
    test_id: 'tst_caf_p1',
    course_id: 'crs_ca_foundation',
    name: 'Accounting — Capital vs Revenue Items',
    subject: 'Principles of Accounting',
    mode: 'practice',
    question_count: 30,
    time_limit_min: 45,
    difficulty: 'medium',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'free',
    published_at: '2026-04-12T00:00:00Z',
    subtype_mix: [
      { subtype: 'standard', count: 18 },
      { subtype: 'assertion_reasoning', count: 6 },
      { subtype: 'case_study', count: 6 },
    ],
  },
  {
    test_id: 'tst_caf_p2',
    course_id: 'crs_ca_foundation',
    name: 'Business Laws — Indian Contract Act Drill',
    subject: 'Business Laws',
    mode: 'practice',
    question_count: 25,
    time_limit_min: 40,
    difficulty: 'hard',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-05-08T00:00:00Z',
    is_new: true,
    subtype_mix: [
      { subtype: 'standard', count: 13 },
      { subtype: 'case_study', count: 8 },
      { subtype: 'hots', count: 4 },
    ],
  },
  {
    test_id: 'tst_caf_p3',
    course_id: 'crs_ca_foundation',
    name: 'Business Economics — Demand, Supply & Elasticity',
    subject: 'Business Economics',
    mode: 'practice',
    question_count: 20,
    time_limit_min: 30,
    difficulty: 'easy',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'free',
    published_at: '2026-04-25T00:00:00Z',
    subtype_mix: [
      { subtype: 'standard', count: 14 },
      { subtype: 'assertion_reasoning', count: 4 },
      { subtype: 'hots', count: 2 },
    ],
  },
  {
    test_id: 'tst_caf_m1',
    course_id: 'crs_ca_foundation',
    name: 'CA Foundation — Full Mock Paper 1',
    subject: 'All 4 Papers',
    mode: 'mock',
    question_count: 100,
    time_limit_min: 180,
    difficulty: 'mixed',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-05-13T00:00:00Z',
    is_new: true,
    promo_code: 'CAFOUND26',
    promo_discount_pct: 100, // 100% off — completely free
    subtype_mix: [
      { subtype: 'standard', count: 50 },
      { subtype: 'assertion_reasoning', count: 15 },
      { subtype: 'case_study', count: 25 },
      { subtype: 'hots', count: 10 },
    ],
  },

  // ─── CA Intermediate ───
  {
    test_id: 'tst_cai_p1',
    course_id: 'crs_ca_inter',
    name: 'Advanced Accounting — Partnership Accounts',
    subject: 'Advanced Accounting',
    mode: 'practice',
    question_count: 30,
    time_limit_min: 50,
    difficulty: 'hard',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-05-09T00:00:00Z',
    is_new: true,
    subtype_mix: [
      { subtype: 'standard', count: 16 },
      { subtype: 'case_study', count: 10 },
      { subtype: 'hots', count: 4 },
    ],
  },
  {
    test_id: 'tst_cai_p2',
    course_id: 'crs_ca_inter',
    name: 'Cost & Management Accounting — Standard Costing',
    subject: 'Cost Accounting',
    mode: 'practice',
    question_count: 25,
    time_limit_min: 40,
    difficulty: 'medium',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'free',
    published_at: '2026-04-30T00:00:00Z',
    subtype_mix: [
      { subtype: 'standard', count: 15 },
      { subtype: 'case_study', count: 6 },
      { subtype: 'hots', count: 4 },
    ],
  },
  {
    test_id: 'tst_cai_p3',
    course_id: 'crs_ca_inter',
    name: 'Auditing — Standards on Auditing (SA 200–299)',
    subject: 'Auditing',
    mode: 'practice',
    question_count: 25,
    time_limit_min: 40,
    difficulty: 'hard',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-05-11T00:00:00Z',
    is_new: true,
    subtype_mix: [
      { subtype: 'standard', count: 12 },
      { subtype: 'case_study', count: 8 },
      { subtype: 'assertion_reasoning', count: 5 },
    ],
  },
  {
    test_id: 'tst_cai_p4',
    course_id: 'crs_ca_inter',
    name: 'Taxation — GST Input Tax Credit Drill',
    subject: 'Taxation',
    mode: 'practice',
    question_count: 25,
    time_limit_min: 40,
    difficulty: 'medium',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-05-12T00:00:00Z',
    is_new: true,
    subtype_mix: [
      { subtype: 'standard', count: 13 },
      { subtype: 'case_study', count: 8 },
      { subtype: 'hots', count: 4 },
    ],
  },
  {
    test_id: 'tst_cai_m1',
    course_id: 'crs_ca_inter',
    name: 'CA Inter — Group I Full Mock',
    subject: 'Accounts, Laws, Cost, Tax',
    mode: 'mock',
    question_count: 100,
    time_limit_min: 180,
    difficulty: 'mixed',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-05-13T00:00:00Z',
    is_new: true,
    promo_code: 'CAINTER26',
    promo_discount_pct: 50, // 50% off
    subtype_mix: [
      { subtype: 'standard', count: 45 },
      { subtype: 'case_study', count: 30 },
      { subtype: 'assertion_reasoning', count: 15 },
      { subtype: 'hots', count: 10 },
    ],
  },
  {
    test_id: 'tst_cai_m2',
    course_id: 'crs_ca_inter',
    name: 'CA Inter — Group II Full Mock',
    subject: 'Auditing, EIS, FM, SM',
    mode: 'mock',
    question_count: 100,
    time_limit_min: 180,
    difficulty: 'mixed',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'ultimate',
    published_at: '2026-05-13T00:00:00Z',
    is_new: true,
    subtype_mix: [
      { subtype: 'standard', count: 50 },
      { subtype: 'case_study', count: 25 },
      { subtype: 'assertion_reasoning', count: 15 },
      { subtype: 'hots', count: 10 },
    ],
  },

  // ─── CA Final ───
  {
    test_id: 'tst_cafin_p1',
    course_id: 'crs_ca_final',
    name: 'Financial Reporting — Ind AS 115 Revenue Recognition',
    subject: 'Financial Reporting',
    mode: 'practice',
    question_count: 25,
    time_limit_min: 45,
    difficulty: 'hard',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-05-10T00:00:00Z',
    is_new: true,
    subtype_mix: [
      { subtype: 'standard', count: 10 },
      { subtype: 'case_study', count: 10 },
      { subtype: 'hots', count: 5 },
    ],
  },
  {
    test_id: 'tst_cafin_p2',
    course_id: 'crs_ca_final',
    name: 'SFM — Capital Budgeting & Risk Analysis',
    subject: 'Strategic Financial Management',
    mode: 'practice',
    question_count: 25,
    time_limit_min: 45,
    difficulty: 'hard',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'ultimate',
    published_at: '2026-05-12T00:00:00Z',
    is_new: true,
    subtype_mix: [
      { subtype: 'standard', count: 12 },
      { subtype: 'case_study', count: 8 },
      { subtype: 'hots', count: 5 },
    ],
  },
  {
    test_id: 'tst_cafin_p3',
    course_id: 'crs_ca_final',
    name: 'Advanced Auditing — SA 700 Series & Professional Ethics',
    subject: 'Advanced Auditing',
    mode: 'practice',
    question_count: 20,
    time_limit_min: 35,
    difficulty: 'medium',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-04-28T00:00:00Z',
    subtype_mix: [
      { subtype: 'standard', count: 10 },
      { subtype: 'case_study', count: 6 },
      { subtype: 'assertion_reasoning', count: 4 },
    ],
  },
  {
    test_id: 'tst_cafin_p4',
    course_id: 'crs_ca_final',
    name: 'Direct Tax Laws — International Taxation',
    subject: 'Direct Tax Laws',
    mode: 'practice',
    question_count: 30,
    time_limit_min: 50,
    difficulty: 'hard',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'ultimate',
    published_at: '2026-05-12T00:00:00Z',
    is_new: true,
    subtype_mix: [
      { subtype: 'standard', count: 12 },
      { subtype: 'case_study', count: 15 },
      { subtype: 'hots', count: 3 },
    ],
  },
  {
    test_id: 'tst_cafin_m1',
    course_id: 'crs_ca_final',
    name: 'CA Final — Group I Full Mock',
    subject: 'FR, SFM, Audit, Laws',
    mode: 'mock',
    question_count: 100,
    time_limit_min: 180,
    difficulty: 'mixed',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'ultimate',
    published_at: '2026-05-13T00:00:00Z',
    is_new: true,
    promo_code: 'CAFINAL26',
    subtype_mix: [
      { subtype: 'standard', count: 35 },
      { subtype: 'case_study', count: 40 },
      { subtype: 'hots', count: 15 },
      { subtype: 'assertion_reasoning', count: 10 },
    ],
  },

  // ─── GST Mastery ───
  {
    test_id: 'tst_gst_p1',
    course_id: 'crs_gst',
    name: 'GST — Registration & Threshold Limits',
    subject: 'GST Registration',
    mode: 'practice',
    question_count: 20,
    time_limit_min: 25,
    difficulty: 'easy',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'free',
    published_at: '2026-04-20T00:00:00Z',
    subtype_mix: [
      { subtype: 'standard', count: 14 },
      { subtype: 'assertion_reasoning', count: 4 },
      { subtype: 'case_study', count: 2 },
    ],
  },
  {
    test_id: 'tst_gst_p2',
    course_id: 'crs_gst',
    name: 'Input Tax Credit — Eligibility & Blocked Credits',
    subject: 'ITC',
    mode: 'practice',
    question_count: 25,
    time_limit_min: 35,
    difficulty: 'medium',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-05-09T00:00:00Z',
    is_new: true,
    subtype_mix: [
      { subtype: 'standard', count: 13 },
      { subtype: 'case_study', count: 8 },
      { subtype: 'hots', count: 4 },
    ],
  },
  {
    test_id: 'tst_gst_m1',
    course_id: 'crs_gst',
    name: 'GST — Complete Practitioner Mock',
    subject: 'CGST + IGST + Returns',
    mode: 'mock',
    question_count: 80,
    time_limit_min: 120,
    difficulty: 'mixed',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-05-12T00:00:00Z',
    is_new: true,
    promo_code: 'GST26',
    promo_discount_pct: 25, // 25% off
    subtype_mix: [
      { subtype: 'standard', count: 40 },
      { subtype: 'case_study', count: 25 },
      { subtype: 'assertion_reasoning', count: 10 },
      { subtype: 'hots', count: 5 },
    ],
  },

  // ─── Income Tax Practice ───
  {
    test_id: 'tst_it_p1',
    course_id: 'crs_income_tax',
    name: 'Salary Head — Allowances & Perquisites',
    subject: 'Income from Salary',
    mode: 'practice',
    question_count: 20,
    time_limit_min: 30,
    difficulty: 'easy',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'free',
    published_at: '2026-04-18T00:00:00Z',
    subtype_mix: [
      { subtype: 'standard', count: 14 },
      { subtype: 'case_study', count: 4 },
      { subtype: 'hots', count: 2 },
    ],
  },
  {
    test_id: 'tst_it_p2',
    course_id: 'crs_income_tax',
    name: 'Capital Gains — Section 54 / 54F Exemptions',
    subject: 'Capital Gains',
    mode: 'practice',
    question_count: 25,
    time_limit_min: 40,
    difficulty: 'hard',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-05-08T00:00:00Z',
    is_new: true,
    subtype_mix: [
      { subtype: 'standard', count: 12 },
      { subtype: 'case_study', count: 9 },
      { subtype: 'hots', count: 4 },
    ],
  },
  {
    test_id: 'tst_it_m1',
    course_id: 'crs_income_tax',
    name: 'Income Tax — Full Computation Mock',
    subject: 'All 5 Heads of Income',
    mode: 'mock',
    question_count: 75,
    time_limit_min: 120,
    difficulty: 'mixed',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-05-13T00:00:00Z',
    is_new: true,
    promo_code: 'IT26',
    subtype_mix: [
      { subtype: 'standard', count: 35 },
      { subtype: 'case_study', count: 25 },
      { subtype: 'hots', count: 10 },
      { subtype: 'assertion_reasoning', count: 5 },
    ],
  },

  // ─── Audit & Assurance ───
  {
    test_id: 'tst_aud_p1',
    course_id: 'crs_audit',
    name: 'Standards on Auditing — Risk Assessment Series',
    subject: 'Standards on Auditing',
    mode: 'practice',
    question_count: 25,
    time_limit_min: 35,
    difficulty: 'medium',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'free',
    published_at: '2026-04-26T00:00:00Z',
    subtype_mix: [
      { subtype: 'standard', count: 15 },
      { subtype: 'assertion_reasoning', count: 6 },
      { subtype: 'case_study', count: 4 },
    ],
  },
  {
    test_id: 'tst_aud_p2',
    course_id: 'crs_audit',
    name: 'Bank Audit — Concurrent & LFAR',
    subject: 'Bank Audit',
    mode: 'practice',
    question_count: 20,
    time_limit_min: 30,
    difficulty: 'hard',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-05-11T00:00:00Z',
    is_new: true,
    subtype_mix: [
      { subtype: 'standard', count: 10 },
      { subtype: 'case_study', count: 7 },
      { subtype: 'hots', count: 3 },
    ],
  },

  // ─── CMA Foundation ───
  {
    test_id: 'tst_cma_p1',
    course_id: 'crs_cma_foundation',
    name: 'Fundamentals of Accounting — Journal & Ledger',
    subject: 'Accounting',
    mode: 'practice',
    question_count: 25,
    time_limit_min: 35,
    difficulty: 'easy',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'free',
    published_at: '2026-04-26T00:00:00Z',
    subtype_mix: [
      { subtype: 'standard', count: 18 },
      { subtype: 'assertion_reasoning', count: 4 },
      { subtype: 'hots', count: 3 },
    ],
  },
  {
    test_id: 'tst_cma_m1',
    course_id: 'crs_cma_foundation',
    name: 'CMA Foundation — Pattern Mock',
    subject: 'All Papers',
    mode: 'mock',
    question_count: 100,
    time_limit_min: 120,
    difficulty: 'mixed',
    negative_marking: true,
    negative_marking_fraction: 0.25,
    required_tier: 'standard',
    published_at: '2026-05-12T00:00:00Z',
    is_new: true,
    promo_code: 'CMA26',
    subtype_mix: [
      { subtype: 'standard', count: 55 },
      { subtype: 'case_study', count: 25 },
      { subtype: 'assertion_reasoning', count: 12 },
      { subtype: 'hots', count: 8 },
    ],
  },
];

export const SAMPLE_NOTIFICATIONS: SampleNotification[] = [
  {
    notification_id: 'ntf_01',
    user_id: 'usr_001',
    type: 'new_test',
    message: 'New mock test available: CA Foundation Full Mock Paper 1',
    test_id: 'tst_caf_m1',
    course_id: 'crs_ca_foundation',
    is_read: false,
    created_at: '2026-05-13T08:30:00Z',
  },
  {
    notification_id: 'ntf_02',
    user_id: 'usr_001',
    type: 'new_test',
    message: 'New practice test: Capital Gains — Section 54 / 54F Exemptions',
    test_id: 'tst_it_p2',
    course_id: 'crs_income_tax',
    is_read: false,
    created_at: '2026-05-13T09:15:00Z',
  },
  {
    notification_id: 'ntf_03',
    user_id: 'usr_001',
    type: 'report_ready',
    message: 'Your AI report for "Accounting — Capital vs Revenue Items" is ready.',
    test_id: 'tst_caf_p1',
    is_read: true,
    created_at: '2026-05-10T14:20:00Z',
  },
  {
    notification_id: 'ntf_04',
    user_id: 'usr_001',
    type: 'subscription_expiry',
    message: 'Your Standard subscription expires in 92 days. Renew to keep mock test access.',
    is_read: false,
    created_at: '2026-05-13T07:00:00Z',
  },
];

const SAMPLE_AI_REPORT_1: SampleAIReport = {
  report_id: 'rpt_01',
  attempt_id: 'att_01',
  summary:
    'Strong grasp of accounting fundamentals and journal entries. Accuracy on revenue recognition under Ind AS dipped to 55% — case-study questions tripped you up. Focus on the 5-step Ind AS 115 model and revisit AS 9 vs Ind AS 115 distinctions before the next mock.',
  strengths: [
    'Journal entries & Trial Balance — 95% accuracy',
    'Capital vs Revenue classification — 92% accuracy',
    'Quick on direct-rule questions (≤45s per Q)',
  ],
  weaknesses: [
    {
      topic: 'Ind AS 115 — Revenue Recognition',
      accuracy: 55,
      recommendation:
        'Revise the 5-step model: identify contract → identify performance obligations → determine transaction price → allocate → recognise. Solve 15 case-study questions this week.',
    },
    {
      topic: 'Depreciation — Component Accounting',
      accuracy: 62,
      recommendation:
        'Practice AS 10 / Ind AS 16 component-wise depreciation problems. Focus on residual value re-estimation and useful life changes.',
    },
  ],
  time_analysis: { avg_seconds_per_question: 72, slow_questions: 4 },
  question_reviews: [
    {
      q_no: 1,
      question:
        'A machinery is purchased for ₹5,00,000 on 1-Apr-2025. Installation charges ₹50,000 and freight ₹20,000 are also paid. What is the cost of the machinery?',
      your_answer: '₹5,70,000',
      correct_answer: '₹5,70,000',
      is_correct: true,
      explanation:
        'Per AS 10 / Ind AS 16, all directly attributable costs to bring the asset to its location and condition for intended use form part of cost: 5,00,000 + 50,000 + 20,000 = ₹5,70,000.',
      time_spent_sec: 45,
    },
    {
      q_no: 2,
      question:
        'XYZ Ltd. sold goods worth ₹10,00,000 on 25-Mar-2026 with a buy-back option at ₹10,50,000 within 30 days. Under Ind AS 115, how should this be recognised?',
      your_answer: 'Revenue of ₹10,00,000',
      correct_answer: 'Treat as a financing arrangement — no revenue',
      is_correct: false,
      explanation:
        'A repurchase right at a higher price means control has not transferred. Under Ind AS 115, this is a financing arrangement; the ₹50,000 difference is interest expense over the buy-back period.',
      time_spent_sec: 110,
    },
    {
      q_no: 3,
      question:
        'An asset costing ₹1,00,000 with useful life of 5 years and salvage ₹10,000 is depreciated on SLM. Annual depreciation?',
      your_answer: '₹18,000',
      correct_answer: '₹18,000',
      is_correct: true,
      explanation: '(Cost − Salvage) / Useful Life = (1,00,000 − 10,000) / 5 = ₹18,000.',
      time_spent_sec: 35,
    },
  ],
  recommendations: [
    'Revisit Ind AS 115 — focus on case-study drills (45 min/day for 1 week).',
    'Attempt "Financial Reporting — Ind AS 115 Revenue Recognition" before next mock.',
    'Build a quick-reference sheet for AS vs Ind AS differences — bind it inside your study folder.',
  ],
  generated_at: '2026-05-10T14:20:00Z',
};

export const SAMPLE_HISTORY: SampleAttempt[] = [
  {
    attempt_id: 'att_01',
    test_id: 'tst_caf_p1',
    test_name: 'Accounting — Capital vs Revenue Items',
    course_id: 'crs_ca_foundation',
    course_name: 'CA Foundation',
    mode: 'practice',
    score: 25,
    total_marks: 30,
    percentage: 83,
    correct: 25,
    incorrect: 4,
    unattempted: 1,
    time_taken_sec: 1980,
    date: '2026-05-10T13:50:00Z',
    passed: true,
    malpractice_events: 0,
    auto_submitted: false,
    ai_report: SAMPLE_AI_REPORT_1,
  },
  {
    attempt_id: 'att_02',
    test_id: 'tst_gst_p1',
    test_name: 'GST — Registration & Threshold Limits',
    course_id: 'crs_gst',
    course_name: 'GST Mastery',
    mode: 'practice',
    score: 16,
    total_marks: 20,
    percentage: 80,
    correct: 16,
    incorrect: 3,
    unattempted: 1,
    time_taken_sec: 1320,
    date: '2026-05-08T11:00:00Z',
    passed: true,
    malpractice_events: 1,
    auto_submitted: false,
    ai_report: { ...SAMPLE_AI_REPORT_1, report_id: 'rpt_02', attempt_id: 'att_02' },
  },
  {
    attempt_id: 'att_03',
    test_id: 'tst_cai_p2',
    test_name: 'Cost & Management Accounting — Standard Costing',
    course_id: 'crs_ca_inter',
    course_name: 'CA Intermediate',
    mode: 'practice',
    score: 18,
    total_marks: 25,
    percentage: 72,
    correct: 18,
    incorrect: 6,
    unattempted: 1,
    time_taken_sec: 2280,
    date: '2026-05-05T15:30:00Z',
    passed: true,
    malpractice_events: 0,
    auto_submitted: false,
    ai_report: { ...SAMPLE_AI_REPORT_1, report_id: 'rpt_03', attempt_id: 'att_03' },
  },
  {
    attempt_id: 'att_04',
    test_id: 'tst_it_p1',
    test_name: 'Salary Head — Allowances & Perquisites',
    course_id: 'crs_income_tax',
    course_name: 'Income Tax Practice',
    mode: 'practice',
    score: 12,
    total_marks: 20,
    percentage: 60,
    correct: 12,
    incorrect: 7,
    unattempted: 1,
    time_taken_sec: 1180,
    date: '2026-04-22T10:15:00Z',
    passed: true,
    percentile: 62,
    malpractice_events: 2,
    auto_submitted: false,
    ai_report: { ...SAMPLE_AI_REPORT_1, report_id: 'rpt_04', attempt_id: 'att_04' },
  },
];

export function isTierSufficient(userTier: SubscriptionTier, requiredTier: SubscriptionTier): boolean {
  return TIER_ORDER.indexOf(userTier) >= TIER_ORDER.indexOf(requiredTier);
}

export function getPlan(tier: SubscriptionTier): SubscriptionPlanInfo {
  return SUBSCRIPTION_PLANS.find(p => p.tier === tier)!;
}

/**
 * Get the base price of a test (in INR).
 * If the test has an explicit `price`, use it; otherwise derive from mode + required_tier.
 * Admin sets price at assessment-creation time; this is the demo default.
 */
export function getTestPrice(test: SampleTest): number {
  if (typeof test.price === 'number') return test.price;
  // Practice tests on Free tier are free; everything else has a fee
  if (test.required_tier === 'free' && test.mode === 'practice') return 0;
  if (test.mode === 'practice') {
    if (test.required_tier === 'standard') return 49;
    if (test.required_tier === 'ultimate') return 99;
    if (test.required_tier === 'premium') return 149;
  }
  // Mock tests
  if (test.mode === 'mock') {
    if (test.required_tier === 'free') return 99;
    if (test.required_tier === 'standard') return 199;
    if (test.required_tier === 'ultimate') return 299;
    if (test.required_tier === 'premium') return 499;
  }
  return 0;
}

/**
 * Promo discount percentage (0–100). Defaults to 100% (free) when a promo_code exists.
 */
export function getPromoDiscountPct(test: SampleTest): number {
  return typeof test.promo_discount_pct === 'number' ? test.promo_discount_pct : 100;
}

/**
 * Effective price the user pays after applying a promo (if any).
 */
export function getEffectivePrice(test: SampleTest, promoApplied: boolean): number {
  const base = getTestPrice(test);
  if (!promoApplied) return base;
  const discountPct = getPromoDiscountPct(test);
  const final = Math.round(base * (1 - discountPct / 100));
  return Math.max(0, final);
}

/**
 * Subscription-level promo codes. Each code grants a percentage discount on the plan price.
 * `applies_to_tiers` (optional) restricts which tiers the code can be used on.
 * `applies_to_billing` (optional) restricts to monthly / yearly.
 */
export interface SubscriptionPromoCode {
  code: string;
  discount_pct: number;
  label: string;
  applies_to_tiers?: SubscriptionTier[];
  applies_to_billing?: ('monthly' | 'yearly')[];
}

export const SUBSCRIPTION_PROMO_CODES: SubscriptionPromoCode[] = [
  {
    code: 'WELCOME26',
    discount_pct: 50,
    label: 'New learner welcome offer — 50% off your first plan',
  },
  {
    code: 'CAYEAR26',
    discount_pct: 25,
    label: '25% off any yearly plan',
    applies_to_billing: ['yearly'],
  },
  {
    code: 'PREMIUM50',
    discount_pct: 50,
    label: '50% off Premium',
    applies_to_tiers: ['premium'],
  },
  {
    code: 'STUDENT100',
    discount_pct: 100,
    label: 'Student access — Standard plan free for a cycle',
    applies_to_tiers: ['standard'],
  },
];

export function findSubscriptionPromo(code: string): SubscriptionPromoCode | null {
  const upper = code.trim().toUpperCase();
  return SUBSCRIPTION_PROMO_CODES.find(p => p.code.toUpperCase() === upper) || null;
}

/**
 * Validate a promo code against a tier + billing cycle.
 * Returns the promo (with discount) if valid, or an error.
 */
export function validateSubscriptionPromo(
  code: string,
  tier: SubscriptionTier,
  billing: 'monthly' | 'yearly',
): { ok: true; promo: SubscriptionPromoCode } | { ok: false; error: string } {
  const promo = findSubscriptionPromo(code);
  if (!promo) return { ok: false, error: 'Invalid or expired promo code' };
  if (promo.applies_to_tiers && !promo.applies_to_tiers.includes(tier)) {
    return { ok: false, error: `This code is not valid for the ${tier} plan` };
  }
  if (promo.applies_to_billing && !promo.applies_to_billing.includes(billing)) {
    return {
      ok: false,
      error: `This code only applies to ${promo.applies_to_billing.join(' / ')} billing`,
    };
  }
  return { ok: true, promo };
}

export function getSubscriptionPlanPrice(
  plan: SubscriptionPlanInfo,
  billing: 'monthly' | 'yearly',
): number {
  return billing === 'monthly' ? plan.price_monthly : plan.price_yearly;
}

export function getEffectivePlanPrice(
  plan: SubscriptionPlanInfo,
  billing: 'monthly' | 'yearly',
  promo: SubscriptionPromoCode | null,
): number {
  const base = getSubscriptionPlanPrice(plan, billing);
  if (!promo) return base;
  return Math.max(0, Math.round(base * (1 - promo.discount_pct / 100)));
}

// ─── Payment / Billing transactions ─────────────────────────────────────────

export type TransactionType = 'test' | 'subscription';
export type TransactionStatus = 'success' | 'failed' | 'refunded';

export interface PaymentTransaction {
  txn_id: string;
  type: TransactionType;
  /** test_id when type='test', tier name when type='subscription' */
  item_id: string;
  /** Human-readable item name */
  item_name: string;
  /** Test mode (only set for type='test') */
  mode?: AssessmentMode;
  /** Billing cycle (only set for type='subscription') */
  billing_cycle?: 'monthly' | 'yearly';
  base_amount: number;
  discount_amount: number;
  final_amount: number;
  promo_code?: string;
  status: TransactionStatus;
  payment_method: 'card' | 'upi' | 'netbanking' | 'wallet';
  invoice_no: string;
  created_at: string;
}

const now = new Date();
const daysAgo = (n: number) =>
  new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

/** Pre-seeded transactions for the demo user. New payments are appended at runtime. */
export const SAMPLE_USER_TRANSACTIONS: PaymentTransaction[] = [
  {
    txn_id: 'txn_u_001',
    type: 'subscription',
    item_id: 'ultimate',
    item_name: 'Ultimate Plan',
    billing_cycle: 'yearly',
    base_amount: 4999,
    discount_amount: 1250,
    final_amount: 3749,
    promo_code: 'CAYEAR26',
    status: 'success',
    payment_method: 'upi',
    invoice_no: 'INV-2026-00821',
    created_at: daysAgo(45),
  },
  {
    txn_id: 'txn_u_002',
    type: 'test',
    item_id: 'test_inter_mock_1',
    item_name: 'CA Inter — Group I Full Mock',
    mode: 'mock',
    base_amount: 299,
    discount_amount: 0,
    final_amount: 299,
    status: 'success',
    payment_method: 'card',
    invoice_no: 'INV-2026-00892',
    created_at: daysAgo(32),
  },
  {
    txn_id: 'txn_u_003',
    type: 'test',
    item_id: 'test_gst_practice_3',
    item_name: 'GST — Input Tax Credit Drills',
    mode: 'practice',
    base_amount: 49,
    discount_amount: 12,
    final_amount: 37,
    promo_code: 'GST26',
    status: 'success',
    payment_method: 'upi',
    invoice_no: 'INV-2026-00917',
    created_at: daysAgo(21),
  },
  {
    txn_id: 'txn_u_004',
    type: 'test',
    item_id: 'test_found_mock_2',
    item_name: 'CA Foundation — Paper 2 Mock',
    mode: 'mock',
    base_amount: 99,
    discount_amount: 99,
    final_amount: 0,
    promo_code: 'CAFOUND26',
    status: 'success',
    payment_method: 'wallet',
    invoice_no: 'INV-2026-00951',
    created_at: daysAgo(14),
  },
  {
    txn_id: 'txn_u_005',
    type: 'test',
    item_id: 'test_itax_mock_1',
    item_name: 'Income Tax — Returns & Computations',
    mode: 'mock',
    base_amount: 199,
    discount_amount: 0,
    final_amount: 199,
    status: 'success',
    payment_method: 'netbanking',
    invoice_no: 'INV-2026-01024',
    created_at: daysAgo(6),
  },
];

const PAYMENT_METHOD_LABEL: Record<PaymentTransaction['payment_method'], string> = {
  card: 'Credit / Debit Card',
  upi: 'UPI',
  netbanking: 'Net Banking',
  wallet: 'Wallet',
};

export function formatPaymentMethod(m: PaymentTransaction['payment_method']): string {
  return PAYMENT_METHOD_LABEL[m];
}

let invoiceCounter = 1100;
export function nextInvoiceNo(): string {
  invoiceCounter += 1;
  return `INV-2026-${String(invoiceCounter).padStart(5, '0')}`;
}

const PAYMENT_METHODS: PaymentTransaction['payment_method'][] = ['card', 'upi', 'netbanking', 'wallet'];
export function randomPaymentMethod(): PaymentTransaction['payment_method'] {
  return PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)];
}
