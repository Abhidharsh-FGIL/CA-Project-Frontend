/**
 * Promotional assessments — a free, scheduled test shared by link (see BACKEND_PROMOTIONAL.md).
 *
 * One paper, open only between `starts_at` and `ends_at`. Before the start the link counts down; after the end it is
 * expired. Taking it is free (it never uses up the plan's tests), it shows in the student's history, and once the
 * window closes the student sees where they stand: the top 50 and their own rank. It is never listed among the
 * exams in the portal; the link, the daily popup and the dashboard card are the ways in.
 */
import { api, publicApi, userApi } from './api';

export type PromotionalPhase = 'upcoming' | 'live' | 'ended';

export interface PromotionalAssessment {
  id: string;
  title: string;
  description?: string | null;
  /** `mock` (exam) or `practice`, as the paper was made. */
  mode?: string | null;
  question_count?: number | null;
  max_score?: number | null;
  time_limit_seconds?: number | null;
  /** When the paper opens and closes (ISO, with offset). */
  starts_at: string;
  ends_at: string;
  /** The admin's switch. Off, the test is closed to everyone whatever the times say. Missing means on. */
  is_active?: boolean;
  /** When the ranks are published. The server may set it later than `ends_at`; else it is `ends_at`. */
  results_at?: string | null;
  /** The server's clock when it answered, so a countdown does not follow a wrong phone clock. */
  server_time?: string | null;
  /** The signed-in student's own state (user endpoints only). */
  attempted?: boolean;
  attempt_id?: string | null;
  in_progress_attempt_id?: string | null;
  /** Admin endpoints only. */
  participants?: number | null;
  created_at?: string | null;
}

export interface LeaderboardRow {
  rank: number;
  user_id: string;
  name: string;
  score: number;
  max_score?: number | null;
  percentage?: number | null;
  time_taken_seconds?: number | null;
  submitted_at?: string | null;
  /** Admin only: to open the attempt's report, and to reach the student. */
  attempt_id?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface Leaderboard {
  assessment_id: string;
  title?: string;
  total_participants: number;
  /** False until `results_at`: the ranks are not out yet. */
  published: boolean;
  results_at?: string | null;
  /** The top 50 (the student's view) or everyone (the admin's), best first. */
  top: LeaderboardRow[];
  /** The signed-in student's own row, ranked, even when it is outside the top 50. Null if they did not take it. */
  me?: LeaderboardRow | null;
}

// ─── Time ─────────────────────────────────────────────────────────────────────

/** How far the device clock is behind the server's, in ms (positive: the device is slow). */
export function clockOffset(serverTime: string | null | undefined, now = Date.now()): number {
  const t = serverTime ? Date.parse(serverTime) : NaN;
  // Only a sizeable gap is believed: a request's own travel time is not a clock error.
  return Number.isFinite(t) && Math.abs(t - now) > 5_000 ? t - now : 0;
}

/** The admin has switched the test off. */
export const switchedOff = (p: Pick<PromotionalAssessment, 'is_active'>): boolean => p.is_active === false;

export function promotionalPhase(p: Pick<PromotionalAssessment, 'starts_at' | 'ends_at' | 'is_active'>, now: number): PromotionalPhase {
  // Switched off, it is closed to students: they see it as expired.
  if (switchedOff(p)) return 'ended';
  const start = Date.parse(p.starts_at);
  const end = Date.parse(p.ends_at);
  if (Number.isFinite(start) && now < start) return 'upcoming';
  if (Number.isFinite(end) && now >= end) return 'ended';
  return 'live';
}

/** When the ranks come out. */
export const resultsAt = (p: Pick<PromotionalAssessment, 'ends_at' | 'results_at'>): string => p.results_at || p.ends_at;

/** A schedule an admin can still change: only before the paper opens. */
export const isEditable = (p: Pick<PromotionalAssessment, 'starts_at'>, now: number): boolean => {
  const start = Date.parse(p.starts_at);
  return Number.isFinite(start) && now < start;
};

/** What is wrong with a start and end, or null. `now` guards a start already in the past. */
export function scheduleProblem(startsAt: string, endsAt: string, now: number): string | null {
  const s = Date.parse(startsAt);
  const e = Date.parse(endsAt);
  if (!Number.isFinite(s)) return 'Set when the test opens.';
  if (!Number.isFinite(e)) return 'Set when the test closes.';
  if (s <= now) return 'The start time has already passed.';
  if (e <= s) return 'The test must close after it opens.';
  return null;
}

/** "Sat, 8 Nov, 6:00 PM" in the viewer's time. */
export function whenLabel(iso: string | null | undefined): string {
  const t = iso ? new Date(iso) : null;
  if (!t || Number.isNaN(t.getTime())) return '';
  return t.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

/** The parts of a countdown, never negative. */
export function countdownParts(ms: number): { days: number; hours: number; minutes: number; seconds: number } {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

/** The link to share: opens the countdown, then sign-in or sign-up, then the test. */
export function shareLink(id: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/promotional/${encodeURIComponent(id)}`;
}

/** An `<input type="datetime-local">` value for an ISO time, in the viewer's zone. */
export function toLocalInput(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** An `<input type="datetime-local">` value as ISO (UTC); '' when empty. */
export const fromLocalInput = (value: string): string => {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString() : '';
};

export { isPromotional, withoutPromotional } from './promotional-flag';

// ─── Public (no sign-in) ─────────────────────────────────────────────────────

export const getPublicPromotional = (id: string) =>
  publicApi.get<PromotionalAssessment>(`/api/v1/public/promotional/${encodeURIComponent(id)}`);

// ─── Student ─────────────────────────────────────────────────────────────────

/** Upcoming and live promotional tests, for the popup and the dashboard card. */
export async function listMyPromotional(): Promise<PromotionalAssessment[]> {
  const res = await userApi.get<PromotionalAssessment[] | { items: PromotionalAssessment[] }>('/api/v1/user/promotional');
  return Array.isArray(res) ? res : (res?.items ?? []);
}

export const getMyPromotional = (id: string) =>
  userApi.get<PromotionalAssessment>(`/api/v1/user/promotional/${encodeURIComponent(id)}`);

export const getMyLeaderboard = async (id: string) =>
  toLeaderboard(await userApi.get<unknown>(`/api/v1/user/promotional/${encodeURIComponent(id)}/leaderboard`), id);

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function listPromotional(orgId?: string | null): Promise<PromotionalAssessment[]> {
  const q = orgId ? `?org_id=${encodeURIComponent(orgId)}` : '';
  const res = await api.get<PromotionalAssessment[] | { items: PromotionalAssessment[] }>(`/api/v1/evaluation/promotional${q}`);
  return Array.isArray(res) ? res : (res?.items ?? []);
}

export interface PromotionalEdit {
  title?: string;
  description?: string | null;
  starts_at?: string;
  ends_at?: string;
  /** The switch: allowed at any time, before or after the start. */
  is_active?: boolean;
}

export const updatePromotional = (id: string, edit: PromotionalEdit) =>
  api.patch<PromotionalAssessment>(`/api/v1/evaluation/promotional/${encodeURIComponent(id)}`, edit);

export const getAdminLeaderboard = async (id: string) =>
  toLeaderboard(await api.get<unknown>(`/api/v1/evaluation/promotional/${encodeURIComponent(id)}/leaderboard`), id);

/**
 * A leaderboard from whatever the server sent. The ranked rows are read from `top`, or from the names other endpoints
 * of this API use for a list (`rows`, `items`, `results`, `leaderboard`, `data`), or from a bare array — so a server
 * that words it a little differently shows its rows instead of breaking the page.
 */
export function toLeaderboard(raw: unknown, id: string): Leaderboard {
  const body = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const list = [Array.isArray(raw) ? raw : null, body.top, body.rows, body.items, body.results, body.leaderboard, body.data, body.entries]
    .find(Array.isArray) as LeaderboardRow[] | undefined;
  const rows = list ?? [];
  return {
    assessment_id: (body.assessment_id as string) ?? id,
    title: body.title as string | undefined,
    total_participants: typeof body.total_participants === 'number' ? body.total_participants : rows.length,
    published: body.published !== false,
    results_at: (body.results_at as string | null | undefined) ?? null,
    top: rows,
    me: (body.me as LeaderboardRow | null | undefined) ?? null,
  };
}

// ─── After sign-in ───────────────────────────────────────────────────────────

const RETURN_KEY = 'mge.returnTo';
/** Long enough to sign up with an OTP, short enough that a stale link does not hijack a later sign-in. */
const RETURN_TTL = 2 * 60 * 60 * 1000;

/** Where to go once signed in or signed up: set by the promotional link, read by the login and sign-up pages. */
export function setReturnTo(path: string): void {
  try {
    localStorage.setItem(RETURN_KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    /* storage blocked — the student lands on the dashboard and finds the test there */
  }
}

/** The pending path, if any and still fresh. Read, not taken: two redirects racing must both see it. */
export function returnTo(): string | null {
  try {
    const raw = localStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: string; at?: number };
    if (typeof path !== 'string' || !path.startsWith('/user/') || !at || Date.now() - at > RETURN_TTL) {
      localStorage.removeItem(RETURN_KEY);
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

/** Cleared by the page it led to, once it is there. */
export function clearReturnTo(): void {
  try {
    localStorage.removeItem(RETURN_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Where a sign-in or sign-up goes: the pending path, else where it would have gone. */
export const afterSignIn = (fallback: string): string => returnTo() ?? fallback;

// ─── The daily popup ─────────────────────────────────────────────────────────

/** Today in India (UTC+5:30), as YYYY-MM-DD — the day the popup is shown once in. */
export function istDay(now = Date.now()): string {
  return new Date(now + 330 * 60 * 1000).toISOString().slice(0, 10);
}

const noticeKey = (userId: string) => `mge.promoNotice.${userId}`;

/** Whether today's popup has been shown to this student already. */
export function noticeShownToday(userId: string, now = Date.now()): boolean {
  try {
    return localStorage.getItem(noticeKey(userId)) === istDay(now);
  } catch {
    return false;
  }
}

export function markNoticeShown(userId: string, now = Date.now()): void {
  try {
    localStorage.setItem(noticeKey(userId), istDay(now));
  } catch {
    /* shown again next visit — harmless */
  }
}

/** The tests worth announcing: not ended, not already taken; the soonest first. */
export function announceable(list: PromotionalAssessment[], now: number): PromotionalAssessment[] {
  return list
    .filter(p => promotionalPhase(p, now) !== 'ended' && !p.attempted)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
}
