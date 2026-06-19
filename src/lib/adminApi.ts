/**
 * Admin Portal API client.
 * All routes are prefixed: /api/v1/admin/...
 */
import { api, BASE_URL, getToken } from './api';

// ─── Shared ────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface MessageResponse {
  message: string;
}

// ─── Dashboard ─────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_questions: number;
  total_papers: number;
  active_tests: number;
  total_users: number;
  subscriptions_by_tier: Record<string, number>;
}

export interface DashboardMetrics {
  total_questions: number;
  total_papers: number;
  active_tests: number;
  archived_tests: number;
  total_users: number;
  active_subscriptions: number;
  total_attempts_month: number;
  reports_generated_month: number;
  delta: Record<string, { value: number; trend: 'up' | 'down' | 'flat'; period: string }>;
}

export interface DailyAttemptBucket {
  date: string;
  label: string;
  practice: number;
  mock: number;
  total: number;
}

export interface RecentAttempt {
  attempt_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  test_id: string;
  test_name: string;
  course: string;
  mode: 'practice' | 'mock';
  score: number;
  total_marks: number;
  percentage: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  malpractice_events: number;
  auto_submitted: boolean;
  status: string;
  started_at: string;
}

export interface RecentTest {
  test_id: string;
  name: string;
  course: string;
  mode: 'practice' | 'mock';
  status: string;
  promo_code: string | null;
  attempts_count: number;
  link_token: string;
  shareable_url: string;
  created_at: string;
}

export interface SubscriptionTierDistribution {
  tier: 'free' | 'standard' | 'ultimate' | 'premium';
  count: number;
  percentage: number;
}

export interface TopCourse {
  course_id: string;
  name: string;
  subject: string;
  exam_body: string;
  status: string;
  attempts: number;
  avg_score: number;
}

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/api/v1/admin/dashboard/stats'),
  getMetrics: () => api.get<DashboardMetrics>('/api/v1/admin/dashboard/metrics'),
  getDailyAttempts: (days = 7) =>
    api.get<{ buckets: DailyAttemptBucket[]; days: number }>(`/api/v1/admin/dashboard/daily-attempts?days=${days}`),
  getRecentAttempts: (limit = 10) =>
    api.get<{ items: RecentAttempt[]; limit: number }>(`/api/v1/admin/dashboard/recent-attempts?limit=${limit}`),
  getSubscriptionDistribution: () =>
    api.get<{ total: number; distribution: SubscriptionTierDistribution[] }>('/api/v1/admin/dashboard/subscription-distribution'),
  getRecentTests: (limit = 5) =>
    api.get<{ items: RecentTest[]; limit: number }>(`/api/v1/admin/dashboard/recent-tests?limit=${limit}`),
  getTopCourses: (limit = 5) =>
    api.get<{ items: TopCourse[]; limit: number }>(`/api/v1/admin/dashboard/top-courses?limit=${limit}`),
};

// ─── Users ─────────────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'standard' | 'ultimate' | 'premium';

export interface AdminUserOut {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  otp_verified: boolean;
  phone_verified: boolean;
  subscription_tier: SubscriptionTier;
  subscription_expiry: string | null;
  created_at: string;
  is_active: boolean;
  account_suspended: boolean;
  account_locked: boolean;
  last_login: string | null;
  total_attempts: number;
}

export interface ListUsersParams {
  tier?: SubscriptionTier;
  is_active?: boolean;
  account_suspended?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export const usersApi = {
  list: (params: ListUsersParams = {}) => {
    const q = new URLSearchParams();
    if (params.tier) q.set('tier', params.tier);
    if (params.is_active !== undefined) q.set('is_active', String(params.is_active));
    if (params.account_suspended !== undefined) q.set('account_suspended', String(params.account_suspended));
    if (params.search) q.set('search', params.search);
    q.set('page', String(params.page ?? 1));
    q.set('limit', String(params.limit ?? 50));
    return api.get<PaginatedResponse<AdminUserOut>>(`/api/v1/admin/users/?${q}`);
  },
  get: (userId: string) => api.get<AdminUserOut>(`/api/v1/admin/users/${userId}`),
  lock: (userId: string) => api.post<MessageResponse>(`/api/v1/admin/users/${userId}/lock`),
  unlock: (userId: string) => api.post<MessageResponse>(`/api/v1/admin/users/${userId}/unlock`),
  suspend: (userId: string, reason?: string) =>
    api.post<MessageResponse>(`/api/v1/admin/users/${userId}/suspend`, { reason }),
  reactivate: (userId: string) => api.post<MessageResponse>(`/api/v1/admin/users/${userId}/reactivate`),
  updateSubscription: (userId: string, tier: SubscriptionTier, expiry_days?: number) =>
    api.patch<AdminUserOut>(`/api/v1/admin/users/${userId}/subscription`, { tier, expiry_days }),
  exportCsv: (params: { tier?: SubscriptionTier; is_active?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.tier) q.set('tier', params.tier);
    if (params.is_active !== undefined) q.set('is_active', String(params.is_active));
    const token = getToken();
    const url = `${BASE_URL}/api/v1/admin/users/export?${q}`;
    const a = document.createElement('a');
    a.href = url;
    if (token) {
      // Trigger via fetch for auth header, then create object URL
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.blob())
        .then(blob => {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `users-export.csv`;
          link.click();
          URL.revokeObjectURL(link.href);
        });
    }
  },
};

// ─── Courses ───────────────────────────────────────────────────────────────

export type CourseStatus = 'active' | 'draft' | 'archived';

export interface AdminCourseOut {
  course_id: string;
  name: string;
  description: string | null;
  subject: string | null;
  exam_body: string | null;
  thumbnail_color: string | null;
  created_by: string | null;
  status: CourseStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  enrolled_users: number;
  total_tests: number;
}

export interface CourseCreatePayload {
  name: string;
  description?: string;
  subject?: string;
  exam_body?: string;
  thumbnail_color?: string;
  status?: CourseStatus;
}

export const coursesApi = {
  list: (page = 1, limit = 50) =>
    api.get<PaginatedResponse<AdminCourseOut>>(`/api/v1/admin/courses/?page=${page}&limit=${limit}`),
  get: (courseId: string) => api.get<AdminCourseOut>(`/api/v1/admin/courses/${courseId}`),
  create: (payload: CourseCreatePayload) => api.post<AdminCourseOut>('/api/v1/admin/courses/', payload),
  update: (courseId: string, payload: Partial<CourseCreatePayload>) =>
    api.put<AdminCourseOut>(`/api/v1/admin/courses/${courseId}`, payload),
  archive: (courseId: string) => api.patch<AdminCourseOut>(`/api/v1/admin/courses/${courseId}/archive`),
  restore: (courseId: string) => api.post<AdminCourseOut>(`/api/v1/admin/courses/${courseId}/restore`),
  delete: (courseId: string) => api.delete<MessageResponse>(`/api/v1/admin/courses/${courseId}`),
};

// ─── Payments ──────────────────────────────────────────────────────────────

export type PaymentType = 'test' | 'subscription';
export type PaymentStatus = 'success' | 'failed' | 'refunded';

export interface PaymentTxnOut {
  txn_id: string;
  user_id: string;
  payment_type: PaymentType;
  item_id: string | null;
  item_name: string | null;
  base_amount: number;
  discount_amount: number;
  final_amount: number;
  promo_code: string | null;
  payment_status: PaymentStatus;
  payment_method: string | null;
  gateway: string | null;
  gateway_txn_ref: string | null;
  invoice_no: string | null;
  created_at: string;
}

export interface PaymentAnalytics {
  total_revenue: number;
  total_transactions: number;
  successful_transactions: number;
  failed_transactions: number;
  refunded_transactions: number;
  revenue_by_type: Record<string, number>;
  revenue_by_day: Array<{ date: string; amount: number }>;
}

export interface ListPaymentsParams {
  payment_type?: PaymentType;
  payment_status?: PaymentStatus;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export const paymentsApi = {
  list: (params: ListPaymentsParams = {}) => {
    const q = new URLSearchParams();
    if (params.payment_type) q.set('payment_type', params.payment_type);
    if (params.payment_status) q.set('payment_status', params.payment_status);
    if (params.user_id) q.set('user_id', params.user_id);
    if (params.date_from) q.set('date_from', params.date_from);
    if (params.date_to) q.set('date_to', params.date_to);
    q.set('page', String(params.page ?? 1));
    q.set('limit', String(params.limit ?? 50));
    return api.get<PaginatedResponse<PaymentTxnOut>>(`/api/v1/admin/payments/?${q}`);
  },
  getAnalytics: (date_from?: string, date_to?: string) => {
    const q = new URLSearchParams();
    if (date_from) q.set('date_from', date_from);
    if (date_to) q.set('date_to', date_to);
    return api.get<PaymentAnalytics>(`/api/v1/admin/payments/analytics?${q}`);
  },
  get: (txnId: string) => api.get<PaymentTxnOut>(`/api/v1/admin/payments/${txnId}`),
  refund: (txnId: string) => api.post<PaymentTxnOut>(`/api/v1/admin/payments/${txnId}/refund`),
  exportCsv: (date_from?: string, date_to?: string) => {
    const q = new URLSearchParams();
    if (date_from) q.set('date_from', date_from);
    if (date_to) q.set('date_to', date_to);
    const token = getToken();
    const url = `${BASE_URL}/api/v1/admin/payments/export?${q}`;
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.blob())
        .then(blob => {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `payments-export.csv`;
          link.click();
          URL.revokeObjectURL(link.href);
        });
    }
  },
};

// ─── Promo Codes ───────────────────────────────────────────────────────────

export type PromoScope = 'test' | 'subscription' | 'platform';
export type PromoStatus = 'active' | 'paused' | 'expired' | 'exhausted';

export interface PromoCodeOut {
  code_id: string;
  code_string: string;
  test_id: string | null;
  max_uses: number; // -1 = unlimited
  used_count: number;
  expiry_date: string | null;
  created_by: string | null;
  created_at: string;
  scope: PromoScope;
  discount_pct: number;
  promo_status: PromoStatus;
  applies_to_tiers: string[] | null;
  applies_to_billing: string[] | null;
}

export interface PromoCreatePayload {
  code_string: string;
  test_id?: string;
  max_uses?: number;
  expiry_date?: string;
  scope?: PromoScope;
  discount_pct?: number;
  applies_to_tiers?: string[];
  applies_to_billing?: string[];
}

export interface PromoUpdatePayload {
  test_id?: string;
  max_uses?: number;
  expiry_date?: string | null;
  scope?: PromoScope;
  discount_pct?: number;
}

export const promosApi = {
  list: (page = 1, limit = 50) =>
    api.get<PaginatedResponse<PromoCodeOut>>(`/api/v1/admin/promos/?page=${page}&limit=${limit}`),
  get: (codeId: string) => api.get<PromoCodeOut>(`/api/v1/admin/promos/${codeId}`),
  create: (payload: PromoCreatePayload) => api.post<PromoCodeOut>('/api/v1/admin/promos/', payload),
  update: (codeId: string, payload: PromoUpdatePayload) =>
    api.patch<PromoCodeOut>(`/api/v1/admin/promos/${codeId}`, payload),
  delete: (codeId: string) => api.delete<MessageResponse>(`/api/v1/admin/promos/${codeId}`),
  pause: (codeId: string) => api.post<PromoCodeOut>(`/api/v1/admin/promos/${codeId}/pause`),
  resume: (codeId: string) => api.post<PromoCodeOut>(`/api/v1/admin/promos/${codeId}/resume`),
};

// ─── Plans ─────────────────────────────────────────────────────────────────

export type PlanName = 'free' | 'standard' | 'ultimate' | 'premium';

export interface PlanOut {
  plan_id: string;
  name: PlanName;
  price: number;
  features: Record<string, unknown> | null;
  duration_days: number;
  active: boolean;
  highlight: boolean;
  price_monthly: number;
  price_yearly: number;
  duration_days_monthly: number;
  duration_days_yearly: number;
  perks: string[] | null;
}

export interface PlanUpdatePayload {
  price?: number;
  features?: Record<string, unknown>;
  duration_days?: number;
  active?: boolean;
  highlight?: boolean;
  price_monthly?: number;
  price_yearly?: number;
  duration_days_monthly?: number;
  duration_days_yearly?: number;
  perks?: string[];
}

export const plansApi = {
  list: () => api.get<PlanOut[]>('/api/v1/admin/plans/'),
  update: (tier: PlanName, payload: PlanUpdatePayload) =>
    api.patch<PlanOut>(`/api/v1/admin/plans/${tier}`, payload),
  toggleActive: (tier: PlanName) => api.post<PlanOut>(`/api/v1/admin/plans/${tier}/toggle-active`),
};

// ─── Audit Log ─────────────────────────────────────────────────────────────

export interface AuditLogOut {
  log_id: string;
  admin_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  timestamp: string;
  actor_name: string | null;
  actor_email: string | null;
  actor_role: string | null;
}

export interface ListAuditParams {
  admin_id?: string;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export const auditApi = {
  list: (params: ListAuditParams = {}) => {
    const q = new URLSearchParams();
    if (params.admin_id) q.set('admin_id', params.admin_id);
    if (params.action) q.set('action', params.action);
    if (params.entity_type) q.set('entity_type', params.entity_type);
    if (params.date_from) q.set('date_from', params.date_from);
    if (params.date_to) q.set('date_to', params.date_to);
    q.set('page', String(params.page ?? 1));
    q.set('limit', String(params.limit ?? 50));
    return api.get<PaginatedResponse<AuditLogOut>>(`/api/v1/admin/audit-log/?${q}`);
  },
  exportCsv: (params: { date_from?: string; date_to?: string; entity_type?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.date_from) q.set('date_from', params.date_from);
    if (params.date_to) q.set('date_to', params.date_to);
    if (params.entity_type) q.set('entity_type', params.entity_type);
    const token = getToken();
    const url = `${BASE_URL}/api/v1/admin/audit-log/export?${q}`;
    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.blob())
        .then(blob => {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `audit-log-export.csv`;
          link.click();
          URL.revokeObjectURL(link.href);
        });
    }
  },
};

// ─── Settings ──────────────────────────────────────────────────────────────

export interface AdminOut {
  admin_id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'content_admin';
  is_active: boolean;
  created_at: string;
}

export interface AdminSettingsResponse {
  profile: AdminOut;
  policy: Record<string, unknown>;
  notifications: Record<string, unknown>;
}

export const settingsApi = {
  get: () => api.get<AdminSettingsResponse>('/api/v1/admin/settings/'),
  updateProfile: (name?: string, email?: string) =>
    api.patch<AdminOut>('/api/v1/admin/settings/profile', { name, email }),
  changePassword: (current_password: string, new_password: string) =>
    api.post<MessageResponse>('/api/v1/admin/settings/change-password', { current_password, new_password }),
  updatePolicy: (settings: Record<string, unknown>) =>
    api.patch<{ message: string; policy: Record<string, unknown> }>('/api/v1/admin/settings/policy', { settings }),
  updateNotifications: (preferences: Record<string, unknown>) =>
    api.patch<{ message: string; notifications: Record<string, unknown> }>('/api/v1/admin/settings/notifications', { preferences }),
};
