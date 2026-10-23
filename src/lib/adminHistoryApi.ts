/**
 * Admin → User History: who has taken which tests, and which promo codes they used.
 *
 *   GET /api/v1/admin/history/users?search=&page=1&limit=20
 *   GET /api/v1/admin/history/users/{user_id}[?mode=mock|practice]
 *
 * Both need the admin token, which `api` sends. Counts cover finished attempts only; the attempts list also
 * shows the ones still in progress. Free TNPSC assessment attempts (mock, practice, key topic) are included,
 * each marked with its `source`.
 */
import { api } from './api';
import type { PaginatedResponse } from './adminApi';

export type HistoryMode = 'mock' | 'practice';
export type HistoryModeFilter = 'all' | HistoryMode;

/** One row of the list, and the header of the detail page. */
export interface HistoryUser {
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  subscription_tier: string;
  joined_at: string | null;
  mock_attempts: number;
  practice_attempts: number;
  total_attempts: number;
  /** Null for someone who has never attended a test. */
  last_attempt_at: string | null;
  promo_codes_used: string[];
}

export type HistoryAttemptStatus = 'submitted' | 'auto_submitted' | 'in_progress';

/**
 * Where an attempt was taken: `test` (a mock or practice test) or `assessment` (a free TNPSC assessment —
 * mock, practice or key topic). An assessment attempt's `test_id` is the assessment's id, and its report is
 * `GET /evaluation/assessments/{test_id}/attempts/{attempt_id}/detail`.
 */
export type HistoryAttemptSource = 'test' | 'assessment';

export interface HistoryAttempt {
  attempt_id: string;
  /** The test's id, or for an assessment attempt the assessment's. */
  test_id: string;
  /** Absent from a server that predates it, which then only has tests. */
  source?: HistoryAttemptSource;
  test_name: string | null;
  mode: HistoryMode;
  status: HistoryAttemptStatus;
  start_time: string;
  end_time: string | null;
  /** Null while the test is in progress. */
  time_taken_seconds: number | null;
  /** Null for an in-progress attempt. */
  score: number | null;
  percentage: number | null;
  auto_submitted: boolean;
}

export interface PromoRedemption {
  code: string;
  scope: string;
  discount_pct: number | null;
  redeemed_at: string;
}

export interface HistoryUserDetail extends HistoryUser {
  attempts: HistoryAttempt[];
  promo_redemptions: PromoRedemption[];
}

export interface HistoryListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export const historyApi = {
  list: (params: HistoryListParams = {}) => {
    const q = new URLSearchParams();
    if (params.search?.trim()) q.set('search', params.search.trim());
    q.set('page', String(params.page ?? 1));
    q.set('limit', String(params.limit ?? 20));
    return api.get<PaginatedResponse<HistoryUser>>(`/api/v1/admin/history/users?${q}`);
  },
  get: (userId: string, mode: HistoryModeFilter = 'all') =>
    api.get<HistoryUserDetail>(
      `/api/v1/admin/history/users/${encodeURIComponent(userId)}${mode === 'all' ? '' : `?mode=${mode}`}`,
    ),
};
