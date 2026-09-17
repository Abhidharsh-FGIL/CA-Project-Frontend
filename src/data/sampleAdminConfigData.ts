// Admin configuration sample data — courses, plans, promo codes, audit log.
// All mutable from the admin UI in demo mode.

import { SAMPLE_COURSES, SUBSCRIPTION_PLANS } from './userPortalSampleData';
import type { SubscriptionPlanInfo, SubscriptionTier, PlanFeatures } from './userPortalSampleData';

// ─── Courses ────────────────────────────────────────────────────────────────

export type CourseStatus = 'active' | 'draft' | 'archived';

export interface AdminCourse {
  course_id: string;
  name: string;
  description: string;
  subject: string;
  status: CourseStatus;
  created_by: string;
  created_at: string;
  enrolled_users?: number;
  total_tests?: number;
  exam_body?: 'ICAI' | 'ICMAI' | 'ICSI' | 'Other';
  thumbnail_color: string;
}

// Seed from existing user-facing courses but add admin metadata
export const SAMPLE_ADMIN_COURSES: AdminCourse[] = SAMPLE_COURSES.map((c, i) => ({
  course_id: c.course_id,
  name: c.name,
  description: c.description,
  subject: c.subject,
  status: 'active' as CourseStatus,
  created_by: 'admin@brightlearn.academy',
  created_at: new Date(Date.now() - (60 - i * 4) * 86_400_000).toISOString(),
  enrolled_users: 245 + i * 87,
  total_tests: c.total_tests,
  exam_body: c.exam_body,
  thumbnail_color: c.thumbnail_color,
}));

// Add a couple of draft / archived examples
SAMPLE_ADMIN_COURSES.push(
  {
    course_id: 'crs_iicab_draft',
    name: 'RRB NTPC — General Awareness',
    description: 'Coverage of Static GK, Current Affairs, Books & Authors, Sports and Important Days for RRB NTPC.',
    subject: 'General Awareness',
    status: 'draft',
    created_by: 'admin@brightlearn.academy',
    created_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    enrolled_users: 0,
    total_tests: 0,
    exam_body: 'Other',
    thumbnail_color: 'from-slate-500 to-gray-700',
  },
  {
    course_id: 'crs_old_csexec',
    name: 'State PSC Hindi (Legacy)',
    description: 'Older syllabus for the State PSC Hindi paper — archived in favour of the updated course.',
    subject: 'Hindi',
    status: 'archived',
    created_by: 'admin@brightlearn.academy',
    created_at: new Date(Date.now() - 220 * 86_400_000).toISOString(),
    enrolled_users: 14,
    total_tests: 6,
    exam_body: 'Other',
    thumbnail_color: 'from-zinc-500 to-stone-600',
  },
);

// ─── Promo Codes ────────────────────────────────────────────────────────────

export type PromoStatus = 'active' | 'expired' | 'exhausted' | 'paused';

export interface AdminPromoCode {
  code_id: string;
  code_string: string;
  scope: 'test' | 'subscription' | 'platform';
  test_id?: string;
  test_name?: string;
  discount_pct: number;
  max_uses: number | null; // null = unlimited
  used_count: number;
  expiry_date: string | null;
  created_by: string;
  created_at: string;
  status: PromoStatus;
}

const _now = Date.now();
const _futureDays = (n: number) => new Date(_now + n * 86_400_000).toISOString();
const _pastDays = (n: number) => new Date(_now - n * 86_400_000).toISOString();

export const SAMPLE_ADMIN_PROMO_CODES: AdminPromoCode[] = [
  {
    code_id: 'pc_001',
    code_string: 'MATHS26',
    scope: 'test',
    test_id: 'test_found_mock_2',
    test_name: 'SSC CGL Quant — Practice Mock 2',
    discount_pct: 100,
    max_uses: 500,
    used_count: 138,
    expiry_date: _futureDays(45),
    created_by: 'admin@brightlearn.academy',
    created_at: _pastDays(20),
    status: 'active',
  },
  {
    code_id: 'pc_002',
    code_string: 'SCIENCE26',
    scope: 'test',
    test_id: 'test_inter_mock_1',
    test_name: 'SSC General Science — Part 1 Full Mock',
    discount_pct: 50,
    max_uses: 1000,
    used_count: 423,
    expiry_date: _futureDays(30),
    created_by: 'admin@brightlearn.academy',
    created_at: _pastDays(35),
    status: 'active',
  },
  {
    code_id: 'pc_003',
    code_string: 'UPSC9GS',
    scope: 'test',
    test_id: 'test_gst_mock_1',
    test_name: 'UPSC General Studies — Full Length Mock',
    discount_pct: 25,
    max_uses: null,
    used_count: 1247,
    expiry_date: _futureDays(60),
    created_by: 'admin@brightlearn.academy',
    created_at: _pastDays(50),
    status: 'active',
  },
  {
    code_id: 'pc_004',
    code_string: 'WELCOME26',
    scope: 'subscription',
    discount_pct: 50,
    max_uses: 2000,
    used_count: 487,
    expiry_date: _futureDays(90),
    created_by: 'admin@brightlearn.academy',
    created_at: _pastDays(15),
    status: 'active',
  },
  {
    code_id: 'pc_005',
    code_string: 'TERM2026',
    scope: 'subscription',
    discount_pct: 25,
    max_uses: null,
    used_count: 184,
    expiry_date: _futureDays(120),
    created_by: 'admin@brightlearn.academy',
    created_at: _pastDays(45),
    status: 'active',
  },
  {
    code_id: 'pc_006',
    code_string: 'PREMIUM50',
    scope: 'subscription',
    discount_pct: 50,
    max_uses: 300,
    used_count: 89,
    expiry_date: _futureDays(15),
    created_by: 'admin@brightlearn.academy',
    created_at: _pastDays(60),
    status: 'active',
  },
  {
    code_id: 'pc_007',
    code_string: 'STUDENT100',
    scope: 'subscription',
    discount_pct: 100,
    max_uses: 100,
    used_count: 100,
    expiry_date: _futureDays(200),
    created_by: 'admin@brightlearn.academy',
    created_at: _pastDays(75),
    status: 'exhausted',
  },
  {
    code_id: 'pc_008',
    code_string: 'LAUNCH26',
    scope: 'platform',
    discount_pct: 30,
    max_uses: 500,
    used_count: 412,
    expiry_date: _pastDays(5),
    created_by: 'admin@brightlearn.academy',
    created_at: _pastDays(95),
    status: 'expired',
  },
  {
    code_id: 'pc_009',
    code_string: 'SCIENCE10',
    scope: 'test',
    test_id: 'test_audit_prac_3',
    test_name: 'RRB General Science — Life Processes Practice',
    discount_pct: 100,
    max_uses: 200,
    used_count: 12,
    expiry_date: _futureDays(75),
    created_by: 'admin@brightlearn.academy',
    created_at: _pastDays(8),
    status: 'paused',
  },
];

// ─── Subscription Plans ─────────────────────────────────────────────────────

export interface AdminPlanRow extends SubscriptionPlanInfo {
  duration_days_monthly: number;
  duration_days_yearly: number;
  active: boolean;
}

export const SAMPLE_ADMIN_PLANS: AdminPlanRow[] = SUBSCRIPTION_PLANS.map(p => ({
  ...p,
  duration_days_monthly: 30,
  duration_days_yearly: 365,
  active: true,
}));

// ─── Platform Users (admin view) ────────────────────────────────────────────

export type UserStatus = 'active' | 'locked' | 'suspended';

export interface AdminUser {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  subscription_tier: SubscriptionTier;
  subscription_expiry: string;
  status: UserStatus;
  otp_verified: boolean;
  created_at: string;
  last_login: string | null;
  failed_login_attempts: number;
  total_attempts: number;
  total_spent: number;
}

export const SAMPLE_ADMIN_USERS: AdminUser[] = [
  {
    user_id: 'usr_priya',
    name: 'Priya Iyer',
    email: 'priya.iyer@example.com',
    phone: '+91 98765 43210',
    subscription_tier: 'premium',
    subscription_expiry: _futureDays(295),
    status: 'active',
    otp_verified: true,
    created_at: _pastDays(180),
    last_login: _pastDays(0),
    failed_login_attempts: 0,
    total_attempts: 38,
    total_spent: 12498,
  },
  {
    user_id: 'usr_rahul',
    name: 'Rahul Sharma',
    email: 'rahul.sharma@example.com',
    phone: '+91 98123 45678',
    subscription_tier: 'ultimate',
    subscription_expiry: _futureDays(28),
    status: 'active',
    otp_verified: true,
    created_at: _pastDays(95),
    last_login: _pastDays(1),
    failed_login_attempts: 0,
    total_attempts: 24,
    total_spent: 4048,
  },
  {
    user_id: 'usr_aanya',
    name: 'Aanya Mehta',
    email: 'aanya.mehta@example.com',
    phone: '+91 99876 54321',
    subscription_tier: 'standard',
    subscription_expiry: _futureDays(12),
    status: 'active',
    otp_verified: true,
    created_at: _pastDays(45),
    last_login: _pastDays(0),
    failed_login_attempts: 1,
    total_attempts: 14,
    total_spent: 448,
  },
  {
    user_id: 'usr_vikram',
    name: 'Vikram Patel',
    email: 'vikram.patel@example.com',
    phone: '+91 98989 11223',
    subscription_tier: 'premium',
    subscription_expiry: _futureDays(120),
    status: 'active',
    otp_verified: true,
    created_at: _pastDays(140),
    last_login: _pastDays(2),
    failed_login_attempts: 0,
    total_attempts: 19,
    total_spent: 8499,
  },
  {
    user_id: 'usr_sneha',
    name: 'Sneha Kapoor',
    email: 'sneha.k@example.com',
    phone: '+91 96544 88991',
    subscription_tier: 'standard',
    subscription_expiry: _futureDays(245),
    status: 'active',
    otp_verified: true,
    created_at: _pastDays(60),
    last_login: _pastDays(0),
    failed_login_attempts: 0,
    total_attempts: 28,
    total_spent: 2499,
  },
  {
    user_id: 'usr_arjun',
    name: 'Arjun Reddy',
    email: 'arjun.r@example.com',
    phone: '+91 88877 66554',
    subscription_tier: 'ultimate',
    subscription_expiry: _futureDays(60),
    status: 'active',
    otp_verified: true,
    created_at: _pastDays(75),
    last_login: _pastDays(3),
    failed_login_attempts: 0,
    total_attempts: 17,
    total_spent: 4248,
  },
  {
    user_id: 'usr_megha',
    name: 'Megha Nair',
    email: 'megha.nair@example.com',
    phone: '+91 99001 22334',
    subscription_tier: 'free',
    subscription_expiry: _futureDays(0),
    status: 'active',
    otp_verified: true,
    created_at: _pastDays(28),
    last_login: _pastDays(1),
    failed_login_attempts: 0,
    total_attempts: 8,
    total_spent: 49,
  },
  {
    user_id: 'usr_karan',
    name: 'Karan Singh',
    email: 'karan.s@example.com',
    phone: '+91 99887 76655',
    subscription_tier: 'standard',
    subscription_expiry: _futureDays(310),
    status: 'locked',
    otp_verified: true,
    created_at: _pastDays(55),
    last_login: _pastDays(8),
    failed_login_attempts: 5,
    total_attempts: 11,
    total_spent: 0,
  },
  {
    user_id: 'usr_divya',
    name: 'Divya Joshi',
    email: 'divya.joshi@example.com',
    phone: '+91 91234 56789',
    subscription_tier: 'free',
    subscription_expiry: _futureDays(0),
    status: 'active',
    otp_verified: true,
    created_at: _pastDays(7),
    last_login: _pastDays(0),
    failed_login_attempts: 0,
    total_attempts: 3,
    total_spent: 99,
  },
  {
    user_id: 'usr_rohit',
    name: 'Rohit Verma',
    email: 'rohit.verma@example.com',
    phone: '+91 98765 11122',
    subscription_tier: 'premium',
    subscription_expiry: _futureDays(180),
    status: 'suspended',
    otp_verified: true,
    created_at: _pastDays(200),
    last_login: _pastDays(20),
    failed_login_attempts: 0,
    total_attempts: 5,
    total_spent: 299,
  },
  {
    user_id: 'usr_pooja',
    name: 'Pooja Bansal',
    email: 'pooja.bansal@example.com',
    phone: '+91 99887 11223',
    subscription_tier: 'premium',
    subscription_expiry: _futureDays(30),
    status: 'active',
    otp_verified: true,
    created_at: _pastDays(35),
    last_login: _pastDays(0),
    failed_login_attempts: 0,
    total_attempts: 22,
    total_spent: 999,
  },
  {
    user_id: 'usr_anil',
    name: 'Anil Kumar',
    email: 'anil.kumar@example.com',
    phone: '+91 90099 88776',
    subscription_tier: 'free',
    subscription_expiry: _futureDays(0),
    status: 'active',
    otp_verified: false,
    created_at: _pastDays(1),
    last_login: null,
    failed_login_attempts: 0,
    total_attempts: 0,
    total_spent: 99,
  },
];

// ─── Audit Log ──────────────────────────────────────────────────────────────

export type AuditAction =
  | 'question_create'
  | 'question_edit'
  | 'question_delete'
  | 'test_publish'
  | 'test_archive'
  | 'test_deactivate'
  | 'paper_create'
  | 'paper_delete'
  | 'course_create'
  | 'course_archive'
  | 'promo_create'
  | 'promo_pause'
  | 'plan_update'
  | 'user_lock'
  | 'user_unlock'
  | 'login'
  | 'logout';

export interface AuditLogEntry {
  log_id: string;
  actor_name: string;
  actor_email: string;
  actor_role: 'super_admin' | 'content_admin';
  action: AuditAction;
  resource_type: 'question' | 'test' | 'paper' | 'course' | 'promo' | 'plan' | 'user' | 'session';
  resource_id: string;
  resource_name?: string;
  description: string;
  ip_address: string;
  timestamp: string;
}

const _hoursAgo = (n: number) => new Date(_now - n * 3_600_000).toISOString();

export const SAMPLE_AUDIT_LOG: AuditLogEntry[] = [
  {
    log_id: 'log_001',
    actor_name: 'Aravindh Kumar',
    actor_email: 'admin@brightlearn.academy',
    actor_role: 'super_admin',
    action: 'test_publish',
    resource_type: 'test',
    resource_id: 'test_inter_mock_4',
    resource_name: 'SSC General Science — Part 2 Full Mock',
    description: 'Published mock test for SSC General Science',
    ip_address: '103.84.21.118',
    timestamp: _hoursAgo(2),
  },
  {
    log_id: 'log_002',
    actor_name: 'Aravindh Kumar',
    actor_email: 'admin@brightlearn.academy',
    actor_role: 'super_admin',
    action: 'question_create',
    resource_type: 'question',
    resource_id: 'q_2026_0432',
    resource_name: '12 questions on Indian Geography & Climate',
    description: 'AI-generated 12 MCQ + 3 A&R on General Studies',
    ip_address: '103.84.21.118',
    timestamp: _hoursAgo(3),
  },
  {
    log_id: 'log_003',
    actor_name: 'Priya Content Creator',
    actor_email: 'priya.creator@brightlearn.academy',
    actor_role: 'content_admin',
    action: 'paper_create',
    resource_type: 'paper',
    resource_id: 'paper_2026_018',
    resource_name: 'IBPS English — Full Paper',
    description: 'Assembled 50-question paper from question bank',
    ip_address: '49.207.215.42',
    timestamp: _hoursAgo(5),
  },
  {
    log_id: 'log_004',
    actor_name: 'Aravindh Kumar',
    actor_email: 'admin@brightlearn.academy',
    actor_role: 'super_admin',
    action: 'promo_create',
    resource_type: 'promo',
    resource_id: 'pc_009',
    resource_name: 'SCIENCE10',
    description: 'Created 100% promo for RRB General Science — Life Processes Practice test',
    ip_address: '103.84.21.118',
    timestamp: _hoursAgo(8),
  },
  {
    log_id: 'log_005',
    actor_name: 'Aravindh Kumar',
    actor_email: 'admin@brightlearn.academy',
    actor_role: 'super_admin',
    action: 'question_edit',
    resource_type: 'question',
    resource_id: 'q_2026_0387',
    resource_name: 'Advanced Maths — Algebra & Equations',
    description: 'Fixed option C wording',
    ip_address: '103.84.21.118',
    timestamp: _hoursAgo(10),
  },
  {
    log_id: 'log_006',
    actor_name: 'Aravindh Kumar',
    actor_email: 'admin@brightlearn.academy',
    actor_role: 'super_admin',
    action: 'user_lock',
    resource_type: 'user',
    resource_id: 'usr_karan',
    resource_name: 'Karan Singh',
    description: 'Account locked after 5 failed login attempts',
    ip_address: 'system',
    timestamp: _hoursAgo(12),
  },
  {
    log_id: 'log_007',
    actor_name: 'Aravindh Kumar',
    actor_email: 'admin@brightlearn.academy',
    actor_role: 'super_admin',
    action: 'plan_update',
    resource_type: 'plan',
    resource_id: 'standard',
    resource_name: 'Standard Plan',
    description: 'Updated monthly price from ₹399 to ₹499',
    ip_address: '103.84.21.118',
    timestamp: _hoursAgo(20),
  },
  {
    log_id: 'log_008',
    actor_name: 'Priya Content Creator',
    actor_email: 'priya.creator@brightlearn.academy',
    actor_role: 'content_admin',
    action: 'question_delete',
    resource_type: 'question',
    resource_id: 'q_2026_0291',
    resource_name: 'Outdated General Science question',
    description: 'Removed outdated question (General Science syllabus update)',
    ip_address: '49.207.215.42',
    timestamp: _hoursAgo(26),
  },
  {
    log_id: 'log_009',
    actor_name: 'Aravindh Kumar',
    actor_email: 'admin@brightlearn.academy',
    actor_role: 'super_admin',
    action: 'course_create',
    resource_type: 'course',
    resource_id: 'crs_iicab_draft',
    resource_name: 'RRB NTPC — General Awareness',
    description: 'Created draft course',
    ip_address: '103.84.21.118',
    timestamp: _hoursAgo(72),
  },
  {
    log_id: 'log_010',
    actor_name: 'Aravindh Kumar',
    actor_email: 'admin@brightlearn.academy',
    actor_role: 'super_admin',
    action: 'test_archive',
    resource_type: 'test',
    resource_id: 'test_old_2025',
    resource_name: 'Legacy 2025 SSC General Science Mock',
    description: 'Archived outdated 2025 syllabus mock',
    ip_address: '103.84.21.118',
    timestamp: _hoursAgo(96),
  },
  {
    log_id: 'log_011',
    actor_name: 'Aravindh Kumar',
    actor_email: 'admin@brightlearn.academy',
    actor_role: 'super_admin',
    action: 'course_archive',
    resource_type: 'course',
    resource_id: 'crs_old_csexec',
    resource_name: 'State PSC Hindi (Legacy)',
    description: 'Archived legacy State PSC Hindi course',
    ip_address: '103.84.21.118',
    timestamp: _hoursAgo(220 * 24),
  },
  {
    log_id: 'log_012',
    actor_name: 'Aravindh Kumar',
    actor_email: 'admin@brightlearn.academy',
    actor_role: 'super_admin',
    action: 'login',
    resource_type: 'session',
    resource_id: 'sess_2026_05_20',
    description: 'Admin signed in',
    ip_address: '103.84.21.118',
    timestamp: _hoursAgo(1),
  },
];

// ─── Admin Settings ─────────────────────────────────────────────────────────

export interface AdminSettings {
  // Admin profile
  admin_name: string;
  admin_email: string;
  admin_role: 'super_admin' | 'content_admin';
  // System policy
  idle_timeout_minutes: number;
  otp_expiry_minutes: number;
  otp_cooldown_seconds: number;
  max_failed_logins: number;
  malpractice_warning_count: number;
  default_negative_marking_fraction: number;
  subscription_reminder_days: number[];
  // Notifications
  email_on_new_user: boolean;
  email_on_payment_failure: boolean;
  email_on_promo_exhausted: boolean;
}

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  admin_name: 'Aravindh Kumar',
  admin_email: 'admin@brightlearn.academy',
  admin_role: 'super_admin',
  idle_timeout_minutes: 30,
  otp_expiry_minutes: 5,
  otp_cooldown_seconds: 60,
  max_failed_logins: 5,
  malpractice_warning_count: 3,
  default_negative_marking_fraction: 0.25,
  subscription_reminder_days: [7, 1],
  email_on_new_user: false,
  email_on_payment_failure: true,
  email_on_promo_exhausted: true,
};

// Helpers
export function isPromoExpired(promo: AdminPromoCode): boolean {
  if (!promo.expiry_date) return false;
  return new Date(promo.expiry_date).getTime() < Date.now();
}

export function isPromoExhausted(promo: AdminPromoCode): boolean {
  if (promo.max_uses == null) return false;
  return promo.used_count >= promo.max_uses;
}

export function computePromoStatus(promo: AdminPromoCode): PromoStatus {
  if (promo.status === 'paused') return 'paused';
  if (isPromoExpired(promo)) return 'expired';
  if (isPromoExhausted(promo)) return 'exhausted';
  return 'active';
}

export type { SubscriptionPlanInfo, SubscriptionTier, PlanFeatures };
