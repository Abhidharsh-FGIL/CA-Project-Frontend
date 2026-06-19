// Sample admin dashboard data — replace with real API calls once backend is ready.

export interface AdminMetric {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  icon: 'bank' | 'paper' | 'test' | 'users' | 'subscription' | 'attempts' | 'reports' | 'promo';
  tone: 'indigo' | 'emerald' | 'amber' | 'rose' | 'blue' | 'purple';
}

export interface AdminRecentAttempt {
  attempt_id: string;
  user_name: string;
  user_email: string;
  course: string;
  test: string;
  score: number;
  total: number;
  percentage: number;
  mode: 'practice' | 'mock';
  date: string;
  malpractice_events?: number;
  auto_submitted?: boolean;
}

export interface AdminRecentTest {
  test_id: string;
  name: string;
  course: string;
  mode: 'practice' | 'mock';
  link_token: string;
  created_at: string;
  attempts_count: number;
  promo_code?: string;
  status: 'active' | 'archived';
}

export interface DailyAttempts {
  date: string;
  label: string;
  practice: number;
  mock: number;
}

export interface SubscriptionDistribution {
  tier: 'free' | 'standard' | 'ultimate' | 'premium';
  count: number;
  percentage: number;
}

export interface TopCourse {
  course_id: string;
  name: string;
  attempts: number;
  avg_score: number;
}

export const ADMIN_METRICS: AdminMetric[] = [
  {
    key: 'questions',
    label: 'Questions in Bank',
    value: 4823,
    displayValue: '4,823',
    icon: 'bank',
    tone: 'indigo',
  },
  {
    key: 'papers',
    label: 'Total Collections',
    value: 84,
    displayValue: '84',
    icon: 'paper',
    tone: 'blue',
  },
  {
    key: 'active_tests',
    label: 'Active Tests',
    value: 32,
    displayValue: '32',
    icon: 'test',
    tone: 'emerald',
  },
  {
    key: 'users',
    label: 'Total Users',
    value: 1856,
    displayValue: '1,856',
    icon: 'users',
    tone: 'purple',
  },
  {
    key: 'subscriptions',
    label: 'Active Subscriptions',
    value: 642,
    displayValue: '642',
    icon: 'subscription',
    tone: 'amber',
  },
  {
    key: 'attempts_today',
    label: "Today's Attempts",
    value: 247,
    displayValue: '247',
    icon: 'attempts',
    tone: 'rose',
  },
];

export const ADMIN_RECENT_ATTEMPTS: AdminRecentAttempt[] = [
  {
    attempt_id: 'att_a1',
    user_name: 'Priya Iyer',
    user_email: 'priya.iyer@example.com',
    course: 'CA Foundation',
    test: 'CA Foundation — Full Mock Paper 1',
    score: 78,
    total: 100,
    percentage: 78,
    mode: 'mock',
    date: '2026-05-15T14:32:00Z',
  },
  {
    attempt_id: 'att_a2',
    user_name: 'Rahul Sharma',
    user_email: 'rahul.sharma@example.com',
    course: 'CA Intermediate',
    test: 'Taxation — GST Input Tax Credit Drill',
    score: 19,
    total: 25,
    percentage: 76,
    mode: 'practice',
    date: '2026-05-15T13:55:00Z',
  },
  {
    attempt_id: 'att_a3',
    user_name: 'Aanya Mehta',
    user_email: 'aanya.mehta@example.com',
    course: 'GST Mastery',
    test: 'GST — Complete Practitioner Mock',
    score: 65,
    total: 80,
    percentage: 81,
    mode: 'mock',
    date: '2026-05-15T13:18:00Z',
  },
  {
    attempt_id: 'att_a4',
    user_name: 'Vikram Patel',
    user_email: 'vikram@example.com',
    course: 'CA Final',
    test: 'Financial Reporting — Ind AS 115 Revenue',
    score: 14,
    total: 25,
    percentage: 56,
    mode: 'practice',
    date: '2026-05-15T12:40:00Z',
    malpractice_events: 2,
  },
  {
    attempt_id: 'att_a5',
    user_name: 'Sneha Kapoor',
    user_email: 'sneha.k@example.com',
    course: 'Income Tax Practice',
    test: 'Capital Gains — Section 54 / 54F Exemptions',
    score: 22,
    total: 25,
    percentage: 88,
    mode: 'practice',
    date: '2026-05-15T11:55:00Z',
  },
  {
    attempt_id: 'att_a6',
    user_name: 'Arjun Reddy',
    user_email: 'arjun.r@example.com',
    course: 'CA Intermediate',
    test: 'Advanced Accounting — Partnership Accounts',
    score: 21,
    total: 30,
    percentage: 70,
    mode: 'practice',
    date: '2026-05-15T11:08:00Z',
  },
  {
    attempt_id: 'att_a7',
    user_name: 'Megha Nair',
    user_email: 'megha.nair@example.com',
    course: 'Audit & Assurance',
    test: 'Bank Audit — Concurrent & LFAR',
    score: 16,
    total: 20,
    percentage: 80,
    mode: 'practice',
    date: '2026-05-15T10:24:00Z',
  },
  {
    attempt_id: 'att_a8',
    user_name: 'Karan Singh',
    user_email: 'karan.s@example.com',
    course: 'CA Foundation',
    test: 'Business Economics — Demand, Supply & Elasticity',
    score: 12,
    total: 20,
    percentage: 60,
    mode: 'practice',
    date: '2026-05-15T09:51:00Z',
    auto_submitted: true,
    malpractice_events: 3,
  },
];

export const ADMIN_RECENT_TESTS: AdminRecentTest[] = [
  {
    test_id: 'tst_caf_m1',
    name: 'CA Foundation — Full Mock Paper 1',
    course: 'CA Foundation',
    mode: 'mock',
    link_token: 'fgi-caf-m1-7x2qkr',
    created_at: '2026-05-13T00:00:00Z',
    attempts_count: 142,
    promo_code: 'CAFOUND26',
    status: 'active',
  },
  {
    test_id: 'tst_cafin_m1',
    name: 'CA Final — Group I Full Mock',
    course: 'CA Final',
    mode: 'mock',
    link_token: 'fgi-cafin-m1-4n8zps',
    created_at: '2026-05-13T00:00:00Z',
    attempts_count: 38,
    promo_code: 'CAFINAL26',
    status: 'active',
  },
  {
    test_id: 'tst_it_m1',
    name: 'Income Tax — Full Computation Mock',
    course: 'Income Tax Practice',
    mode: 'mock',
    link_token: 'fgi-it-m1-9v3blw',
    created_at: '2026-05-13T00:00:00Z',
    attempts_count: 67,
    promo_code: 'IT26',
    status: 'active',
  },
  {
    test_id: 'tst_cai_m1',
    name: 'CA Inter — Group I Full Mock',
    course: 'CA Intermediate',
    mode: 'mock',
    link_token: 'fgi-cai-m1-2k7dft',
    created_at: '2026-05-13T00:00:00Z',
    attempts_count: 91,
    promo_code: 'CAINTER26',
    status: 'active',
  },
  {
    test_id: 'tst_gst_m1',
    name: 'GST — Complete Practitioner Mock',
    course: 'GST Mastery',
    mode: 'mock',
    link_token: 'fgi-gst-m1-6h1jym',
    created_at: '2026-05-12T00:00:00Z',
    attempts_count: 53,
    promo_code: 'GST26',
    status: 'active',
  },
];

export const DAILY_ATTEMPTS: DailyAttempts[] = [
  { date: '2026-05-09', label: 'Sat', practice: 142, mock: 28 },
  { date: '2026-05-10', label: 'Sun', practice: 165, mock: 41 },
  { date: '2026-05-11', label: 'Mon', practice: 187, mock: 35 },
  { date: '2026-05-12', label: 'Tue', practice: 198, mock: 47 },
  { date: '2026-05-13', label: 'Wed', practice: 215, mock: 52 },
  { date: '2026-05-14', label: 'Thu', practice: 201, mock: 48 },
  { date: '2026-05-15', label: 'Fri', practice: 189, mock: 58 },
];

export const SUBSCRIPTION_DISTRIBUTION: SubscriptionDistribution[] = [
  { tier: 'free', count: 1214, percentage: 65.4 },
  { tier: 'standard', count: 412, percentage: 22.2 },
  { tier: 'ultimate', count: 178, percentage: 9.6 },
  { tier: 'premium', count: 52, percentage: 2.8 },
];

export const TOP_COURSES: TopCourse[] = [
  { course_id: 'crs_ca_foundation', name: 'CA Foundation', attempts: 487, avg_score: 71 },
  { course_id: 'crs_ca_inter', name: 'CA Intermediate', attempts: 392, avg_score: 67 },
  { course_id: 'crs_gst', name: 'GST Mastery', attempts: 268, avg_score: 74 },
  { course_id: 'crs_ca_final', name: 'CA Final', attempts: 156, avg_score: 62 },
  { course_id: 'crs_income_tax', name: 'Income Tax Practice', attempts: 211, avg_score: 69 },
];

export const TIER_LABEL: Record<SubscriptionDistribution['tier'], string> = {
  free: 'Free',
  standard: 'Standard',
  ultimate: 'Ultimate',
  premium: 'Premium',
};

export const TIER_COLOR: Record<SubscriptionDistribution['tier'], string> = {
  free: 'bg-gray-400',
  standard: 'bg-blue-500',
  ultimate: 'bg-indigo-500',
  premium: 'bg-gradient-to-r from-amber-400 to-orange-500',
};
