/**
 * Institutes: a coaching centre or college that gets its own sign-in page and sees only its own students.
 *
 * Admin (admin token), under /api/v1/admin/institutes:
 *   GET    /                       ?search=&page=&limit=   → PaginatedResponse<Institute>
 *   POST   /                       { name, contact_number, email, password }
 *   GET    /{institute_id}
 *   PATCH  /{institute_id}         { name?, contact_number?, email?, is_active? }
 *   POST   /{institute_id}/reset-password   { password }
 *
 * Institute (its own token, kept apart from the admin and student ones), under /api/v1/institute:
 *   POST   /auth/login             { slug, email, password } → { access_token, refresh_token, institute }
 *   POST   /auth/refresh           { refresh_token }
 *   POST   /auth/logout            { refresh_token }
 *   GET    /me                     → Institute
 *   GET    /history/users          ?search=&page=&limit=     → the institute's students only
 *   GET    /history/users/{user_id}[?mode=mock|practice]     → one student, 404 for anyone outside the institute
 *   GET    /history/attempts/{attempt_id}                    → that attempt's report, as the student sees it
 *
 * A student is tied to an institute by signing up from its link (`#/register?institute=<slug>`), which the sign-up
 * call carries as `institute_slug`. See BACKEND_INSTITUTES.md.
 */
import { api, buildUrl, toRequestError } from './api';
import { fetchOrExplain } from './network-error';
import type { PaginatedResponse } from './adminApi';
import type { HistoryListParams, HistoryModeFilter, HistorySource, HistoryUser, HistoryUserDetail } from './adminHistoryApi';

export interface Institute {
  institute_id: string;
  name: string;
  /** The part of the sign-in address that names the institute, chosen by the server from the name. */
  slug: string;
  contact_number: string;
  email: string;
  is_active: boolean;
  created_at: string | null;
  /** How many students are tied to it. Absent from a server that does not count them. */
  student_count?: number;
}

export interface InstituteInput {
  name: string;
  contact_number: string;
  email: string;
  password: string;
}

export type InstituteUpdate = Partial<Pick<Institute, 'name' | 'contact_number' | 'email' | 'is_active'>>;

// ─── Addresses ────────────────────────────────────────────────────────────────

/** "Sri Ram Academy (Chennai)" → "sri-ram-academy-chennai". The server has the last word; this is the preview. */
export function instituteSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** This app's own address, up to the "#". The app routes by hash, so every page address is this plus "#/…". */
function appBase(): string {
  return typeof window === 'undefined' ? '' : window.location.href.split('#')[0];
}

/** Where the institute signs in. */
export const instituteLoginUrl = (slug: string) => `${appBase()}#/institute/${slug}`;

/** The link its students sign up from, so they are tied to it. */
export const instituteSignupUrl = (slug: string) => `${appBase()}#/register?institute=${encodeURIComponent(slug)}`;

// ─── Admin side ───────────────────────────────────────────────────────────────

export const adminInstitutesApi = {
  list: (params: { search?: string; page?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.search?.trim()) q.set('search', params.search.trim());
    q.set('page', String(params.page ?? 1));
    q.set('limit', String(params.limit ?? 20));
    return api.get<PaginatedResponse<Institute>>(`/api/v1/admin/institutes?${q}`);
  },
  get: (id: string) => api.get<Institute>(`/api/v1/admin/institutes/${encodeURIComponent(id)}`),
  create: (body: InstituteInput) => api.post<Institute>('/api/v1/admin/institutes', body),
  update: (id: string, body: InstituteUpdate) => api.patch<Institute>(`/api/v1/admin/institutes/${encodeURIComponent(id)}`, body),
  resetPassword: (id: string, password: string) =>
    api.post<{ message?: string }>(`/api/v1/admin/institutes/${encodeURIComponent(id)}/reset-password`, { password }),
};

/** An institute's students, read by the admin: the same history list, narrowed to one institute. */
export function adminInstituteHistory(instituteId: string, historyApi: HistorySource): HistorySource {
  return {
    key: `admin-institute:${instituteId}`,
    list: (params: HistoryListParams = {}) => historyApi.list({ ...params, institute_id: instituteId }),
    get: (userId: string, mode: HistoryModeFilter = 'all') => historyApi.get(userId, mode),
  };
}

// ─── Institute session ────────────────────────────────────────────────────────

const ACCESS = 'institute_access_token';
const REFRESH = 'institute_refresh_token';
const SLUG = 'institute_slug';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the session lasts until the page closes */
  }
}

export const instituteSession = {
  token: () => read(ACCESS),
  /** Which institute is signed in on this browser. */
  slug: () => read(SLUG),
  signedInTo: (slug: string) => !!read(ACCESS) && read(SLUG) === slug,
  save(access: string, refresh: string | null, slug: string) {
    write(ACCESS, access);
    write(REFRESH, refresh);
    write(SLUG, slug);
  },
  clear() {
    write(ACCESS, null);
    write(REFRESH, null);
    write(SLUG, null);
  },
};

interface LoginReply {
  access_token: string;
  refresh_token?: string;
  institute?: Institute;
}

async function send<T>(path: string, init: RequestInit, token: string | null): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetchOrExplain(buildUrl(path), { ...init, headers });
  if (res.status === 401 && token) {
    // One refresh, then one retry; a refusal ends the session.
    const fresh = await refresh();
    if (fresh) return send<T>(path, init, fresh);
    instituteSession.clear();
    throw Object.assign(new Error('Your session has ended. Please sign in again.'), { status: 401 });
  }
  if (!res.ok) throw toRequestError(await res.json().catch(() => ({ message: res.statusText })), res.status);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

async function refresh(): Promise<string | null> {
  const token = read(REFRESH);
  const slug = read(SLUG);
  if (!token || !slug) return null;
  try {
    const res = await fetchOrExplain(buildUrl('/api/v1/institute/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: token }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as LoginReply;
    instituteSession.save(data.access_token, data.refresh_token ?? token, slug);
    return data.access_token;
  } catch {
    return null;
  }
}

const authed = <T>(path: string) => send<T>(path, { method: 'GET' }, instituteSession.token());

export async function loginInstitute(slug: string, email: string, password: string): Promise<Institute | null> {
  const res = await send<LoginReply>(
    '/api/v1/institute/auth/login',
    { method: 'POST', body: JSON.stringify({ slug, email, password }) },
    null,
  );
  if (!res?.access_token) throw new Error('Sign-in failed. Please try again.');
  instituteSession.save(res.access_token, res.refresh_token ?? null, slug);
  return res.institute ?? null;
}

export async function logoutInstitute(): Promise<void> {
  const refreshToken = read(REFRESH);
  try {
    if (instituteSession.token()) {
      await send('/api/v1/institute/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) }, instituteSession.token());
    }
  } catch {
    /* signing out never fails for the person doing it */
  } finally {
    instituteSession.clear();
  }
}

export const instituteMe = () => authed<Institute>('/api/v1/institute/me');

/**
 * One attempt's full report, in the same shape as the student's own (`GET /user/history/{attempt_id}`), for a
 * student of this institute. 404 for anyone else's attempt.
 */
export const instituteAttemptReport = (attemptId: string) =>
  authed<any>(`/api/v1/institute/history/attempts/${encodeURIComponent(attemptId)}`);

/** The date a plan ends, under whichever name the server uses for it. */
function withExpiry<T extends object>(row: T): T {
  const r = row as Record<string, unknown>;
  const raw = ['subscription_expiry', 'subscription_expires_at', 'plan_expiry', 'plan_expires_at', 'expires_at', 'expiry_date']
    .map(k => r[k])
    .find(v => typeof v === 'string' && v);
  return raw ? ({ ...row, subscription_expiry: raw } as T) : row;
}

/** The institute's own view of its students: the same shape the admin History reads, from the institute's endpoints. */
export const instituteHistory: HistorySource = {
  key: 'institute',
  list: (params: HistoryListParams = {}) => {
    const q = new URLSearchParams();
    if (params.search?.trim()) q.set('search', params.search.trim());
    q.set('page', String(params.page ?? 1));
    q.set('limit', String(params.limit ?? 20));
    return authed<PaginatedResponse<HistoryUser>>(`/api/v1/institute/history/users?${q}`).then(res => ({ ...res, items: (res.items ?? []).map(withExpiry) }));
  },
  get: (userId: string, mode: HistoryModeFilter = 'all') =>
    authed<HistoryUserDetail>(`/api/v1/institute/history/users/${encodeURIComponent(userId)}${mode === 'all' ? '' : `?mode=${mode}`}`).then(withExpiry),
};

// ─── Sign-up link ─────────────────────────────────────────────────────────────

const LINK_KEY = 'institute_signup_slug';

/** Remember the institute a sign-up link named: a Google sign-in can reload the page and lose the address. */
export function rememberInstituteLink(search: string): void {
  const slug = new URLSearchParams(search).get('institute')?.trim().toLowerCase();
  if (slug && /^[a-z0-9-]{1,80}$/.test(slug)) write(LINK_KEY, slug);
}

/** `{ institute_slug }` for a sign-up made from an institute's link, else nothing to add. */
export function instituteSignupField(): { institute_slug?: string } {
  const slug = read(LINK_KEY);
  return slug ? { institute_slug: slug } : {};
}

export const forgetInstituteLink = () => write(LINK_KEY, null);
