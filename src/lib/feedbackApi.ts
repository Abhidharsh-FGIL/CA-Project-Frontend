/**
 * Feedback: a student sends a rating and a message from the user portal; the admin reads them all.
 *
 *   POST  /api/v1/user/feedback                  { rating, category, message, page? }      → the saved row
 *   GET   /api/v1/user/feedback?page=&limit=     the student's own feedback, newest first
 *
 *   GET   /api/v1/admin/feedback?rating=&category=&status=&date_from=&date_to=&search=&page=&limit=
 *   GET   /api/v1/admin/feedback/summary?<the same filters>   → { total, average_rating, new_count, by_rating }
 *   PATCH /api/v1/admin/feedback/:id             { status }                                → the saved row
 *   GET   /api/v1/admin/feedback/export?<the same filters>    → feedback_<date>.xlsx
 *
 * Dates are `YYYY-MM-DD`, read in IST. Every figure and time shown is the server's.
 */
import { api, apiDownload, userApi } from './api';
import type { PaginatedResponse } from './adminApi';

export type FeedbackCategory = 'general' | 'bug' | 'suggestion' | 'content' | 'payment';
export type FeedbackStatus = 'new' | 'reviewed' | 'resolved';

export interface FeedbackInput {
  rating: number;
  category: FeedbackCategory;
  message: string;
  /** The screen the student was on, when they opened the form. */
  page?: string | null;
}

/** What a student sees of their own feedback. */
export interface MyFeedback {
  feedback_id: string;
  rating: number;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  created_at: string;
}

/** What the admin sees: the same, with who sent it. */
export interface AdminFeedbackRow extends MyFeedback {
  user_id: string;
  name: string;
  email: string | null;
  mobile: string | null;
  page: string | null;
  /** "02 Nov 2026, 04:12 PM" — written by the server, in IST. */
  created_at_ist: string;
}

export interface FeedbackFilters {
  rating?: number | '';
  category?: FeedbackCategory | '';
  status?: FeedbackStatus | '';
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface FeedbackSummary {
  total: number;
  average_rating: number | null;
  new_count: number;
  /** How many gave each rating, keyed "1" to "5". */
  by_rating: Record<string, number>;
}

export const MESSAGE_MAX = 1000;
export const MESSAGE_MIN = 5;
export const EXPORT_LIMIT = 50_000;

export const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string; hint: string }[] = [
  { value: 'general', label: 'General', hint: 'Anything about the app' },
  { value: 'suggestion', label: 'Suggestion', hint: 'An idea to make it better' },
  { value: 'bug', label: 'Something is wrong', hint: 'A bug or an error' },
  { value: 'content', label: 'Questions & content', hint: 'A wrong answer or a missing topic' },
  { value: 'payment', label: 'Plans & payment', hint: 'Subscription or billing' },
];

export const categoryLabel = (c: string | null | undefined): string =>
  CATEGORY_OPTIONS.find(o => o.value === c)?.label ?? (c || '—');

export const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
];

export const statusLabel = (s: string | null | undefined): string =>
  STATUS_OPTIONS.find(o => o.value === s)?.label ?? (s || '—');

export const RATING_LABEL = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

/** Why a feedback cannot be sent yet, or null when it can. */
export function feedbackProblem(input: Pick<FeedbackInput, 'rating' | 'message'>): string | null {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) return 'Please choose a rating from 1 to 5 stars.';
  const text = input.message.trim();
  if (text.length < MESSAGE_MIN) return 'Please tell us a little more, at least a few words.';
  if (text.length > MESSAGE_MAX) return `Please keep it under ${MESSAGE_MAX} characters.`;
  return null;
}

/** The query string for the admin's filters; only the ones filled in. */
export function feedbackQuery(filters: FeedbackFilters, extra: Record<string, string | number> = {}): string {
  const p = new URLSearchParams();
  if (filters.date_from) p.set('date_from', filters.date_from);
  if (filters.date_to) p.set('date_to', filters.date_to);
  if (filters.rating) p.set('rating', String(filters.rating));
  if (filters.category) p.set('category', filters.category);
  if (filters.status) p.set('status', filters.status);
  const search = filters.search?.trim();
  if (search) p.set('search', search);
  for (const [k, v] of Object.entries(extra)) p.set(k, String(v));
  const q = p.toString();
  return q ? `?${q}` : '';
}

export const feedbackDateRangeBackwards = (f: Pick<FeedbackFilters, 'date_from' | 'date_to'>): boolean =>
  !!f.date_from && !!f.date_to && f.date_from > f.date_to;

export const feedbackHasFilters = (f: FeedbackFilters): boolean =>
  !!(f.date_from || f.date_to || f.rating || f.category || f.status || f.search?.trim());

export function feedbackFileName(now: Date = new Date()): string {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  return `feedback_${day}.xlsx`;
}

export const feedbackApi = {
  send: (input: FeedbackInput) =>
    userApi.post<MyFeedback>('/api/v1/user/feedback', {
      rating: input.rating,
      category: input.category,
      message: input.message.trim(),
      page: input.page ?? null,
    }),
  mine: (page = 1, limit = 20) => userApi.get<PaginatedResponse<MyFeedback>>(`/api/v1/user/feedback?page=${page}&limit=${limit}`),
};

export const adminFeedbackApi = {
  list: (filters: FeedbackFilters, page = 1, limit = 50) =>
    api.get<PaginatedResponse<AdminFeedbackRow>>(`/api/v1/admin/feedback${feedbackQuery(filters, { page, limit: Math.min(limit, 500) })}`),
  summary: (filters: FeedbackFilters) => api.get<FeedbackSummary>(`/api/v1/admin/feedback/summary${feedbackQuery(filters)}`),
  setStatus: (id: string, status: FeedbackStatus) => api.patch<AdminFeedbackRow>(`/api/v1/admin/feedback/${encodeURIComponent(id)}`, { status }),
  exportPath: (filters: FeedbackFilters) => `/api/v1/admin/feedback/export${feedbackQuery(filters)}`,
};

/** Download every feedback row matching the filters as an Excel sheet. Throws the server's message when it refuses. */
export async function downloadFeedback(filters: FeedbackFilters): Promise<void> {
  const blob = await apiDownload(adminFeedbackApi.exportPath(filters));
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = feedbackFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
